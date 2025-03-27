import type { NextApiRequest, NextApiResponse } from 'next';

import { getCookie } from 'cookies-next';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { fieldsContainUnsignedRequiredField } from '@documenso/lib/utils/advanced-fields-helpers';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import type { Document, Recipient } from '@documenso/prisma/client';
import {
  DocumentSigningOrder,
  DocumentStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobs } from '../../jobs/client';
import { fetchWithLaravelAuth } from '../../laravel-auth/fetch-with-laravel-auth';
import type { TRecipientActionAuth } from '../../types/document-auth';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { getIsRecipientsTurnToSign } from '../recipient/get-is-recipient-turn';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';
import { sendPendingEmail } from './send-pending-email';

interface DocumentDetails {
  companyName?: string;
  facilityAdministrator?: string;
  documentName?: string;
  residentName?: string;
  locationName?: string;
}

type GetDocumentOptions = {
  token: string;
  documentId: number;
};

export type CompleteDocumentWithTokenOptions = GetDocumentOptions & {
  userId?: number;
  authOptions?: TRecipientActionAuth;
  requestMetadata?: RequestMetadata;
  req: NextApiRequest;
  res: NextApiResponse;
};

const getDocument = async ({ token, documentId }: GetDocumentOptions) => {
  return await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
      recipients: {
        some: {
          token,
        },
      },
    },
    include: {
      documentMeta: true,
      recipients: {
        where: {
          token,
        },
      },
      documentData: true,
    },
  });
};

export const completeDocumentWithToken = async ({
  token,
  documentId,
  requestMetadata,
  req,
  res,
}: CompleteDocumentWithTokenOptions) => {
  const document = await getDocument({ token, documentId });
  const rawDetails = document?.documentDetails;

  if (!rawDetails || typeof rawDetails !== 'object') {
    throw new Error('Invalid or missing documentDetails');
  }

  const documentDetails: DocumentDetails = rawDetails;

  if (document.status !== DocumentStatus.PENDING) {
    throw new Error(`Document ${document.id} must be pending`);
  }

  if (document.recipients.length === 0) {
    throw new Error(`Document ${document.id} has no recipient with token ${token}`);
  }

  const [recipient] = document.recipients;

  if (recipient.signingStatus === SigningStatus.SIGNED) {
    throw new Error(`Recipient ${recipient.id} has already signed`);
  }

  if (recipient.signingStatus === SigningStatus.REJECTED) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Recipient has already rejected the document',
      statusCode: 400,
    });
  }

  if (document.documentMeta?.signingOrder === DocumentSigningOrder.SEQUENTIAL) {
    const isRecipientsTurn = await getIsRecipientsTurnToSign({ token: recipient.token });

    if (!isRecipientsTurn) {
      throw new Error(
        `Recipient ${recipient.id} attempted to complete the document before it was their turn`,
      );
    }
  }

  const fields = await prisma.field.findMany({
    where: {
      documentId: document.id,
      recipientId: recipient.id,
    },
  });

  if (fieldsContainUnsignedRequiredField(fields)) {
    throw new Error(`Recipient ${recipient.id} has unsigned fields`);
  }

  // Document reauth for completing documents is currently not required.

  // const { derivedRecipientActionAuth } = extractDocumentAuthMethods({
  //   documentAuth: document.authOptions,
  //   recipientAuth: recipient.authOptions,
  // });

  // const isValid = await isRecipientAuthorized({
  //   type: 'ACTION',
  //   document: document,
  //   recipient: recipient,
  //   userId,
  //   authOptions,
  // });

  // if (!isValid) {
  //   throw new AppError(AppErrorCode.UNAUTHORIZED, 'Invalid authentication values');
  // }

  await prisma.$transaction(async (tx) => {
    await tx.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        signingStatus: SigningStatus.SIGNED,
        signedAt: new Date(),
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED,
        documentId: document.id,
        user: {
          name: recipient.name,
          email: recipient.email,
        },
        requestMetadata,
        data: {
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientId: recipient.id,
          recipientRole: recipient.role,
        },
      }),
    });
  });

  await storeSignedDocument(
    {
      ...document,
      documentDetails,
    },
    documentDetails,
    documentId,
    recipient,
    req,
    res,
  );

  await jobs.triggerJob({
    name: 'send.recipient.signed.email',
    payload: {
      documentId: document.id,
      recipientId: recipient.id,
    },
  });

  const pendingRecipients = await prisma.recipient.findMany({
    select: {
      id: true,
      signingOrder: true,
      name: true,
      email: true,
      role: true,
    },
    where: {
      documentId: document.id,
      signingStatus: {
        not: SigningStatus.SIGNED,
      },
      role: {
        not: RecipientRole.CC,
      },
    },
    // Composite sort so our next recipient is always the one with the lowest signing order or id
    // if there is a tie.
    orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
  });

  if (pendingRecipients.length > 0) {
    await sendPendingEmail({ documentId, recipientId: recipient.id });

    if (document.documentMeta?.signingOrder === DocumentSigningOrder.SEQUENTIAL) {
      const [nextRecipient] = pendingRecipients;

      await prisma.$transaction(async (tx) => {
        await tx.recipient.update({
          where: { id: nextRecipient.id },
          data: { sendStatus: SendStatus.SENT },
        });

        await jobs.triggerJob({
          name: 'send.signing.requested.email',
          payload: {
            userId: document.userId,
            documentId: document.id,
            recipientId: nextRecipient.id,
            requestMetadata,
          },
        });
      });
    }
  }

  const haveAllRecipientsSigned = await prisma.document.findFirst({
    where: {
      id: document.id,
      recipients: {
        every: {
          OR: [{ signingStatus: SigningStatus.SIGNED }, { role: RecipientRole.CC }],
        },
      },
    },
  });

  const allSigned = Boolean(haveAllRecipientsSigned);

  if (haveAllRecipientsSigned) {
    await jobs.triggerJob({
      name: 'internal.seal-document',
      payload: {
        documentId: document.id,
        requestMetadata,
      },
    });

    await storeSignedDocument(
      {
        ...document,
        documentDetails,
      },
      documentDetails,
      documentId,
      recipient,
      req,
      res,
      allSigned,
    );
  }

  const updatedDocument = await prisma.document.findFirstOrThrow({
    where: {
      id: document.id,
    },
    include: {
      documentMeta: true,
      recipients: true,
    },
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_SIGNED,
    data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(updatedDocument)),
    userId: updatedDocument.userId,
    teamId: updatedDocument.teamId ?? undefined,
  });
};

const storeSignedDocument = async (
  document: Document & {
    documentData: { data: Buffer | string };
    documentDetails?: DocumentDetails | null;
  },
  documentDetails: DocumentDetails | undefined,
  documentId: number,
  recipient: Recipient,
  req: NextApiRequest,
  res: NextApiResponse,
  allSigned: boolean = false,
) => {
  try {
    const authToken = await getCookie('laravel_jwt', { req, res });

    if (typeof authToken !== 'string' || !authToken) {
      throw new Error('Token not found or invalid in cookies.');
    }

    if (!authToken) throw new Error('Token not found in cookies');

    const base64File = Buffer.isBuffer(document.documentData.data)
      ? document.documentData.data.toString('base64')
      : document.documentData.data;

    const formData = {
      clientName: String(documentDetails?.companyName || ''),
      documensoId: String(documentId),
      documentKey: String(document.formKey || ''),
      residentId: String(document.residentId || ''),
      base64File: base64File,
      recipient: allSigned ? 'AllRecipientsSigned' : recipient?.email,
    };

    const apiUrl = process.env.NEXT_PRIVATE_LARAVEL_API_URL;
    const url = `${apiUrl}/residents/electronic-signature/store-signed-document`;

    if (!apiUrl) {
      throw new Error('Environment variables for the Laravel API are not defined.');
    }

    return await fetchWithLaravelAuth(
      url,
      {
        method: 'POST',
        body: JSON.stringify(formData),
      },
      authToken,
    );
  } catch (error) {
    console.error('Error storing signed document:', error);
    throw new Error('Could not store the signed document.');
  }
};
