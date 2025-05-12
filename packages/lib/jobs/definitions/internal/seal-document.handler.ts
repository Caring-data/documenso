import { nanoid } from 'nanoid';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

import { prisma } from '@documenso/prisma';
import {
  DocumentStatus,
  RecipientRole,
  SigningStatus,
  WebhookTriggerEvents,
} from '@documenso/prisma/client';

import { sendCompletedEmail } from '../../../server-only/document/send-completed-email';
import PostHogServerClient from '../../../server-only/feature-flags/get-post-hog-server-client';
import { getCertificatePdf } from '../../../server-only/htmltopdf/get-certificate-pdf';
import { storeSignedDocument } from '../../../server-only/laravel-auth/storeSignedDocument';
import { triggerWebhook } from '../../../server-only/webhooks/trigger/trigger-webhook';
import type { TDocumentDetails } from '../../../types/document';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../../types/webhook-payload';
import { getFile } from '../../../universal/upload/get-file';
import { putPdfFile } from '../../../universal/upload/put-file';
import { fieldsContainUnsignedRequiredField } from '../../../utils/advanced-fields-helpers';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSealDocumentJobDefinition } from './seal-document';

export const run = async ({
  payload,
  io,
}: {
  payload: TSealDocumentJobDefinition;
  io: JobRunIO;
}) => {
  const { documentId, sendEmail = true, isResealing = false, requestMetadata } = payload;

  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
      recipients: {
        every: {
          signingStatus: SigningStatus.SIGNED,
        },
      },
    },
    include: {
      documentMeta: true,
      recipients: true,
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

  // Seems silly but we need to do this in case the job is re-ran
  // after it has already run through the update task further below.
  // eslint-disable-next-line @typescript-eslint/require-await
  const documentStatus = await io.runTask('get-document-status', async () => {
    return document.status;
  });

  // This is the same case as above.
  // eslint-disable-next-line @typescript-eslint/require-await
  const documentDataId = await io.runTask('get-document-data-id', async () => {
    return document.documentDataId;
  });

  const documentData = await prisma.documentData.findFirst({
    where: {
      id: documentDataId,
    },
  });

  if (!documentData) {
    throw new Error(`Document ${document.id} has no document data`);
  }

  const recipients = await prisma.recipient.findMany({
    where: {
      documentId: document.id,
      role: {
        not: RecipientRole.CC,
      },
    },
  });

  if (recipients.some((recipient) => recipient.signingStatus !== SigningStatus.SIGNED)) {
    throw new Error(`Document ${document.id} has unsigned recipients`);
  }

  const fields = await prisma.field.findMany({
    where: {
      documentId: document.id,
    },
    include: {
      signature: true,
    },
  });

  if (fieldsContainUnsignedRequiredField(fields)) {
    throw new Error(`Document ${document.id} has unsigned required fields`);
  }

  if (isResealing) {
    // If we're resealing we want to use the initial data for the document
    // so we aren't placing fields on top of eachother.
    documentData.data = documentData.initialData;
  }

  const pdfData = await getFile(documentData);

  let certificateData = null;

  try {
    if (document.team?.teamGlobalSettings?.includeSigningCertificate ?? true) {
      certificateData = await getCertificatePdf({
        documentId,
        language: document.documentMeta?.language,
      });
    }
  } catch (error) {
    console.error('Error generating certificate PDF:', error);
  }

  const newDataId = await io.runTask('decorate-and-sign-pdf', async () => {
    try {
      const pdfDoc = await PDFDocument.load(pdfData);

      if (certificateData) {
        const certificateDoc = await PDFDocument.load(certificateData);
        const certificatePages = await pdfDoc.copyPages(
          certificateDoc,
          certificateDoc.getPageIndices(),
        );

        certificatePages.forEach((page) => {
          pdfDoc.addPage(page);
        });
      }

      const finalPdfBytes = await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false,
      });
      console.log(`📦 Final PDF size: ${(finalPdfBytes.length / 1024 / 1024).toFixed(2)} MB`);

      const { name } = path.parse(document.title);

      const documentData = await putPdfFile({
        name: `${name}_signed.pdf`,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(finalPdfBytes),
      });

      return documentData.id;
    } catch (error) {
      console.error('Critical error in PDF process:', error);
      throw error;
    }
  });

  const postHog = PostHogServerClient();

  if (postHog) {
    postHog.capture({
      distinctId: nanoid(),
      event: 'App: Document Sealed',
      properties: {
        documentId: document.id,
      },
    });
  }

  await io.runTask('update-document', async () => {
    try {
      await prisma.$transaction(
        async (tx) => {
          const newData = await tx.documentData.findFirstOrThrow({
            where: {
              id: newDataId,
            },
          });

          await tx.document.update({
            where: {
              id: document.id,
            },
            data: {
              status: DocumentStatus.COMPLETED,
              completedAt: new Date(),
            },
          });

          await tx.documentData.update({
            where: {
              id: documentData.id,
            },
            data: {
              data: newData.data,
            },
          });

          await tx.documentAuditLog.create({
            data: createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED,
              documentId: document.id,
              requestMetadata,
              user: null,
              data: {
                transactionId: nanoid(),
              },
            }),
          });
        },
        { timeout: 60000 },
      );
    } catch (error) {
      console.error('Transaction error:', error);
    }
  });

  await io.runTask('send-completed-email', async () => {
    let shouldSendCompletedEmail = sendEmail && !isResealing;

    if (isResealing && documentStatus !== DocumentStatus.COMPLETED) {
      shouldSendCompletedEmail = sendEmail;
    }

    if (shouldSendCompletedEmail) {
      await sendCompletedEmail({ documentId, requestMetadata });
    }
  });

  const updatedDocument = await prisma.document.findFirstOrThrow({
    where: {
      id: document.id,
    },
    include: {
      documentData: true,
      documentMeta: true,
      recipients: true,
    },
  });

  const rawDetails = document?.documentDetails;

  if (!rawDetails || typeof rawDetails !== 'object') {
    throw new Error('Invalid or missing documentDetails');
  }

  const documentDetails: TDocumentDetails = rawDetails;

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_COMPLETED,
    data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(updatedDocument)),
    userId: updatedDocument.userId,
    teamId: updatedDocument.teamId ?? undefined,
  });

  await io.runTask('send-to-laravel', async () => {
    try {
      const base64Data = updatedDocument.documentData?.data;

      if (!base64Data || typeof base64Data !== 'string') {
        console.warn('The base64 of the signed document could not be obtained.');
        return;
      }

      const mainRecipient = updatedDocument.recipients.find((r) => r.role !== RecipientRole.CC);

      if (!mainRecipient) {
        console.warn('No primary recipient was found for the Laravel submission.');
        return;
      }

      await storeSignedDocument(
        updatedDocument,
        base64Data,
        documentDetails,
        updatedDocument.id,
        mainRecipient,
        true,
      );
    } catch (error) {
      console.error('Error when sending the signed document to Laravel:', error);
    }
  });
};
