import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { fieldsContainUnsignedRequiredField } from '@documenso/lib/utils/advanced-fields-helpers';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
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
import type { TRecipientActionAuth } from '../../types/document-auth';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { createLog } from '../../utils/createLog';
import { storeSignedDocument } from '../laravel-auth/storeSignedDocument';
import { generateSignedPdf } from '../pdf/generate-signed-pdf';
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
      team: {
        select: {
          teamGlobalSettings: {
            select: {
              includeSigningCertificate: true,
            },
          },
        },
      },
    },
  });
};

export const completeDocumentWithToken = async ({
  token,
  documentId,
  requestMetadata,
}: CompleteDocumentWithTokenOptions) => {
  try {
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
            recipientEmail: recipient.email ?? '',
            recipientName: recipient.name,
            recipientId: recipient.id,
            recipientRole: recipient.role,
          },
        }),
      });
    });

    await jobs.triggerJob({
      name: 'document.complete.processing',
      payload: {
        documentId: document.id,
        recipientId: recipient.id,
        requestMetadata,
      },
    });

    return { success: true, documentId: document.id, recipientId: recipient.id };
  } catch (error) {
    await createLog({
      action: 'COMPLETE_DOCUMENT_ERROR',
      message: 'Error al completar el documento con token',
      data: {
        error: error instanceof Error ? error.message : String(error),
        documentId,
        token,
      },
      metadata: requestMetadata,
    });

    throw error;
  }
};

export const processDocumentCompletion = async ({
  documentId,
  recipientId,
  requestMetadata,
}: {
  documentId: number;
  recipientId: number;
  requestMetadata?: RequestMetadata;
}) => {
  try {
    const document = await prisma.document.findFirstOrThrow({
      where: { id: documentId },
      include: {
        documentMeta: true,
        recipients: true,
        documentData: true,
        team: {
          select: {
            teamGlobalSettings: {
              select: {
                includeSigningCertificate: true,
              },
            },
          },
        },
      },
    });

    const recipient = document.recipients.find((r) => r.id === recipientId);
    if (!recipient) {
      throw new Error(`Recipient ${recipientId} not found`);
    }

    const rawDetails = document?.documentDetails;
    if (!rawDetails || typeof rawDetails !== 'object') {
      throw new Error('Invalid or missing documentDetails');
    }

    const documentDetails: DocumentDetails = rawDetails;

    await jobs.triggerJob({
      name: 'send.recipient.signed.email',
      payload: {
        documentId: document.id,
        recipientId: recipient.id,
      },
    });

    const documentFields = await prisma.field.findMany({
      where: {
        documentId: document.id,
      },
      include: {
        signature: true,
      },
    });

    const signedPdfBuffer = await generateSignedPdf({
      document: {
        ...document,
        documentData: { data: document.documentData.data },
      },
      fields: documentFields,
      certificateData: null,
    });

    const base64SignedPdf = signedPdfBuffer.toString('base64');

    await storeSignedDocument(
      document,
      base64SignedPdf,
      documentDetails,
      document.id,
      recipient,
      false,
    );

    await prisma.documentData.update({
      where: { id: document.documentData.id },
      data: { data: base64SignedPdf },
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

    if (haveAllRecipientsSigned) {
      await jobs.triggerJob({
        name: 'internal.seal-document',
        payload: {
          documentId: document.id,
          requestMetadata,
        },
      });

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
    }
  } catch (error) {
    await createLog({
      action: 'PROCESS_DOCUMENT_COMPLETION_ERROR',
      message: 'Error al procesar la finalización del documento',
      data: {
        error: error instanceof Error ? error.message : String(error),
        documentId,
        recipientId,
      },
      metadata: requestMetadata,
    });

    throw error;
  }
};
