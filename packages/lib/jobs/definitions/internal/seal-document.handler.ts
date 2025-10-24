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
import { compressPdfBuffer } from '../../../server-only/pdf/compressPdf';
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
import { createLog } from '../../../utils/createLog';
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

  await createLog({
    action: 'SEAL_DOCUMENT_JOB_START',
    message: 'Starting document sealing job',
    data: {
      documentId,
      sendEmail,
      isResealing,
    },
    metadata: requestMetadata,
  });

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
    await createLog({
      action: 'DOCUMENT_DATA_NOT_FOUND',
      message: 'Document data not found',
      data: { documentId, documentDataId },
      metadata: requestMetadata,
      userId: document.userId,
    });
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
    await createLog({
      action: 'UNSIGNED_RECIPIENTS_FOUND',
      message: 'Document has unsigned recipients',
      data: {
        documentId,
        unsignedRecipients: recipients
          .filter((r) => r.signingStatus !== SigningStatus.SIGNED)
          .map((r) => ({ id: r.id, email: r.email, status: r.signingStatus })),
      },
      metadata: requestMetadata,
      userId: document.userId,
    });
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
    await createLog({
      action: 'UNSIGNED_REQUIRED_FIELDS_FOUND',
      message: 'Document has unsigned required fields',
      data: {
        documentId,
        totalFields: fields.length,
      },
      metadata: requestMetadata,
      userId: document.userId,
    });
    throw new Error(`Document ${document.id} has unsigned required fields`);
  }

  if (isResealing) {
    await createLog({
      action: 'RESEALING_DOCUMENT',
      message: 'Using initial data for document resealing',
      data: { documentId },
      metadata: requestMetadata,
      userId: document.userId,
    });
    // If we're resealing we want to use the initial data for the document
    // so we aren't placing fields on top of eachother.
    documentData.data = documentData.initialData;
  }

  const pdfData = await getFile(documentData);

  await createLog({
    action: 'PDF_FILE_RETRIEVED',
    message: 'PDF file retrieved successfully',
    data: {
      documentId,
      pdfSize: pdfData.length,
    },
    metadata: requestMetadata,
    userId: document.userId,
  });

  let certificateData = null;

  try {
    if (document.team?.teamGlobalSettings?.includeSigningCertificate ?? true) {
      await createLog({
        action: 'GENERATING_CERTIFICATE_PDF',
        message: 'Starting certificate PDF generation',
        data: {
          documentId,
          language: document.documentMeta?.language,
        },
        metadata: requestMetadata,
        userId: document.userId,
      });

      certificateData = await getCertificatePdf({
        documentId,
        language: document.documentMeta?.language,
      });

      await createLog({
        action: 'CERTIFICATE_PDF_GENERATED',
        message: 'Certificate PDF generated successfully',
        data: {
          documentId,
          certificateSize: certificateData?.length,
        },
        metadata: requestMetadata,
        userId: document.userId,
      });
    } else {
      await createLog({
        action: 'CERTIFICATE_PDF_SKIPPED',
        message: 'Certificate PDF generation skipped (disabled in settings)',
        data: { documentId },
        metadata: requestMetadata,
        userId: document.userId,
      });
    }
  } catch (error) {
    console.error('Error generating certificate PDF:', error);

    await createLog({
      action: 'CERTIFICATE_PDF_ERROR',
      message: 'Error generating certificate PDF during sealing process',
      data: {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      },
      metadata: requestMetadata,
      userId: document.userId,
    });
  }

  const newDataId = await io.runTask('decorate-and-sign-pdf', async () => {
    try {
      const pdfDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });

      if (certificateData) {
        const certificateDoc = await PDFDocument.load(certificateData, { ignoreEncryption: true });
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

      const compressedPdf = await compressPdfBuffer(Buffer.from(finalPdfBytes), 'medium');

      const { name } = path.parse(document.title);

      const documentData = await putPdfFile({
        name: `${name}_signed.pdf`,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(compressedPdf),
      });

      return documentData.id;
    } catch (error) {
      console.error('Critical error in PDF process:', error);
      await createLog({
        action: 'PDF_SIGNING_ERROR',
        message: 'Critical error while processing or signing the PDF',
        data: {
          documentId,
          error: error instanceof Error ? error.message : String(error),
        },
        metadata: requestMetadata,
        userId: document.userId,
      });

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

    await createLog({
      action: 'POSTHOG_EVENT_CAPTURED',
      message: 'PostHog event captured',
      data: {
        documentId,
        event: 'App: Document Sealed',
      },
      metadata: requestMetadata,
      userId: document.userId,
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

      await createLog({
        action: 'DOCUMENT_STATUS_UPDATED',
        message: 'Document status updated to COMPLETED successfully',
        data: {
          documentId,
          newStatus: DocumentStatus.COMPLETED,
        },
        metadata: requestMetadata,
        userId: document.userId,
      });
    } catch (error) {
      console.error('Transaction error:', error);

      await createLog({
        action: 'SEAL_DOCUMENT_TRANSACTION_ERROR',
        message: 'Transaction error when updating document status or data',
        data: {
          documentId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        metadata: requestMetadata,
        userId: document.userId,
      });
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
    await createLog({
      action: 'INVALID_DOCUMENT_DETAILS',
      message: 'Invalid or missing document details',
      data: {
        documentId,
        rawDetails,
      },
      metadata: requestMetadata,
      userId: document.userId,
    });
    throw new Error('Invalid or missing documentDetails');
  }

  const documentDetails: TDocumentDetails = rawDetails;

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_COMPLETED,
    data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(updatedDocument)),
    userId: updatedDocument.userId,
    teamId: updatedDocument.teamId ?? undefined,
  });

  await createLog({
    action: 'COMPLETION_WEBHOOK_TRIGGERED',
    message: 'Document completion webhook triggered successfully',
    data: { documentId },
    metadata: requestMetadata,
    userId: document.userId,
  });

  await io.runTask('send-to-laravel', async () => {
    try {
      const base64Data = updatedDocument.documentData?.data;

      if (!base64Data || typeof base64Data !== 'string') {
        await createLog({
          action: 'LARAVEL_SUBMISSION_SKIPPED_NO_DATA',
          message: 'Laravel submission skipped - no base64 data available',
          data: {
            documentId,
            hasDocumentData: !!updatedDocument.documentData,
            dataType: typeof base64Data,
          },
          metadata: requestMetadata,
          userId: updatedDocument.userId,
        });
        console.warn('The base64 of the signed document could not be obtained.');
        return;
      }

      const mainRecipient = updatedDocument.recipients.find((r) => r.role !== RecipientRole.CC);

      if (!mainRecipient) {
        await createLog({
          action: 'LARAVEL_SUBMISSION_SKIPPED_NO_RECIPIENT',
          message: 'Laravel submission skipped - no main recipient found',
          data: {
            documentId,
            totalRecipients: updatedDocument.recipients.length,
            recipientRoles: updatedDocument.recipients.map((r) => r.role),
          },
          metadata: requestMetadata,
          userId: updatedDocument.userId,
        });
        console.warn('No primary recipient was found for the Laravel submission.');
        return;
      }

      const { fileUrl } = await storeSignedDocument(
        updatedDocument,
        base64Data,
        documentDetails,
        updatedDocument.id,
        mainRecipient,
        true,
      );

      if (fileUrl) {
        await prisma.document.update({
          where: { id: document.id },
          data: { documentUrl: fileUrl },
        });

        await createLog({
          action: 'DOCUMENT_URL_UPDATED',
          message: 'Document URL updated successfully',
          data: {
            documentId,
            fileUrl,
          },
          metadata: requestMetadata,
          userId: updatedDocument.userId,
        });
      } else {
        await createLog({
          action: 'NO_FILE_URL_RETURNED',
          message: 'No file URL returned from Laravel submission',
          data: { documentId },
          metadata: requestMetadata,
          userId: updatedDocument.userId,
        });
      }
    } catch (error) {
      console.error('Error when sending the signed document to Laravel:', error);

      await createLog({
        action: 'LARAVEL_SUBMISSION_ERROR',
        message: 'Error when submitting signed document to Laravel',
        data: {
          documentId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        metadata: requestMetadata,
        userId: updatedDocument.userId,
      });
    }
  });

  await createLog({
    action: 'LARAVEL_SUBMISSION_TASK_COMPLETED',
    message: 'Laravel submission task completed',
    data: { documentId },
    metadata: requestMetadata,
    userId: document.userId,
  });

  await io.runTask('send-completed-email', async () => {
    let shouldSendCompletedEmail = sendEmail && !isResealing;

    if (isResealing && documentStatus !== DocumentStatus.COMPLETED) {
      shouldSendCompletedEmail = sendEmail;
    }

    await createLog({
      action: 'SEND_COMPLETED_EMAIL_CHECK',
      message: 'Checking if completion email should be sent',
      data: {
        documentId,
        shouldSend: shouldSendCompletedEmail,
        sendEmail,
        isResealing,
        documentStatus,
      },
      metadata: requestMetadata,
      userId: document.userId,
    });

    if (shouldSendCompletedEmail) {
      await sendCompletedEmail({ documentId, requestMetadata });

      await createLog({
        action: 'COMPLETED_EMAIL_SENT',
        message: 'Document completion email sent successfully',
        data: { documentId },
        metadata: requestMetadata,
        userId: document.userId,
      });
    } else {
      await createLog({
        action: 'COMPLETED_EMAIL_SKIPPED',
        message: 'Document completion email skipped',
        data: {
          documentId,
          reason: !sendEmail ? 'sendEmail=false' : 'isResealing=true',
        },
        metadata: requestMetadata,
        userId: document.userId,
      });
    }
  });
};
