import { createNextRoute } from '@ts-rest/next';
import { format } from 'date-fns';
import { match } from 'ts-pattern';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { DATE_FORMATS, DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import '@documenso/lib/constants/time-zones';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { AppError } from '@documenso/lib/errors/app-error';
import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { upsertDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import { createDocument } from '@documenso/lib/server-only/document/create-document';
import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';
import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { resendDocument } from '@documenso/lib/server-only/document/resend-document';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { updateDocument as updateDocumentSettings } from '@documenso/lib/server-only/document/update-document';
import { deleteField } from '@documenso/lib/server-only/field/delete-field';
import { getFieldById } from '@documenso/lib/server-only/field/get-field-by-id';
import { getFieldsForDocument } from '@documenso/lib/server-only/field/get-fields-for-document';
import { updateField } from '@documenso/lib/server-only/field/update-field';
import { insertFormValuesInPdf } from '@documenso/lib/server-only/pdf/insert-form-values-in-pdf';
import { deleteRecipient } from '@documenso/lib/server-only/recipient/delete-recipient';
import { getRecipientByIdV1Api } from '@documenso/lib/server-only/recipient/get-recipient-by-id-v1-api';
import { getRecipientsForDocument } from '@documenso/lib/server-only/recipient/get-recipients-for-document';
import { setDocumentRecipients } from '@documenso/lib/server-only/recipient/set-document-recipients';
import { updateRecipient } from '@documenso/lib/server-only/recipient/update-recipient';
import { createTeamMemberInvites } from '@documenso/lib/server-only/team/create-team-member-invites';
import { deleteTeamMembers } from '@documenso/lib/server-only/team/delete-team-members';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { createDocumentFromTemplateLegacy } from '@documenso/lib/server-only/template/create-document-from-template-legacy';
import { createTemplate } from '@documenso/lib/server-only/template/create-template';
import { deleteTemplate } from '@documenso/lib/server-only/template/delete-template';
import { findTemplates } from '@documenso/lib/server-only/template/find-templates';
import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import { extractDerivedDocumentEmailSettings } from '@documenso/lib/types/document-email';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZFieldMetaSchema,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { nanoid } from '@documenso/lib/universal/id';
import { getFile } from '@documenso/lib/universal/upload/get-file';
import { putPdfFile } from '@documenso/lib/universal/upload/put-file';
import {
  getPresignGetUrl,
  getPresignPostUrl,
} from '@documenso/lib/universal/upload/server-actions';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { Prisma } from '@documenso/prisma/client';
import {
  DocumentDataType,
  DocumentStatus,
  SigningStatus,
  TeamMemberRole,
} from '@documenso/prisma/client';

import { ApiContractV1 } from './contract';
import { authenticatedMiddleware } from './middleware/authenticated';

type AuditLogData = {
  recipientEmail?: string;
  emailType?: string;
  isResending?: boolean;
};

export const ApiContractV1Implementation = createNextRoute(ApiContractV1, {
  getDocuments: authenticatedMiddleware(async (args, user, team) => {
    const page = Number(args.query.page) || 1;
    const perPage = Number(args.query.perPage) || 10;

    const { data: documents, totalPages } = await findDocuments({
      page,
      perPage,
      userId: user.id,
      teamId: team?.id,
    });

    return {
      status: 200,
      body: {
        documents,
        totalPages,
      },
    };
  }),

  getDocument: authenticatedMiddleware(async (args, user, team) => {
    const { id: documentId } = args.params;

    try {
      const document = await getDocumentById({
        documentId: Number(documentId),
        userId: user.id,
        teamId: team?.id,
      });

      const recipients = await getRecipientsForDocument({
        documentId: Number(documentId),
        userId: user.id,
        teamId: team?.id,
      });

      const fields = await getFieldsForDocument({
        documentId: Number(documentId),
        userId: user.id,
        teamId: team?.id,
      });

      const parsedMetaFields = fields.map((field) => {
        let parsedMetaOrNull = null;

        if (field.fieldMeta) {
          const result = ZFieldMetaSchema.safeParse(field.fieldMeta);

          if (!result.success) {
            throw new Error('Field meta parsing failed for field ' + field.id);
          }

          parsedMetaOrNull = result.data;
        }

        return {
          ...field,
          fieldMeta: parsedMetaOrNull,
        };
      });

      return {
        status: 200,
        body: {
          ...document,
          recipients: recipients.map((recipient) => ({
            ...recipient,
            signingUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`,
          })),
          fields: parsedMetaFields,
        },
      };
    } catch (err) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }
  }),

  getSignedStatus: authenticatedMiddleware(async (args) => {
    const { id: documentId } = args.params;

    const document = await prisma.document.findUnique({
      where: { id: Number(documentId) },
      include: {
        documentMeta: true,
      },
    });

    if (!document) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    const timezone = document.documentMeta?.timezone ?? 'America/Los_Angeles';

    const auditLogs = await prisma.documentAuditLog.findMany({
      where: {
        documentId: Number(documentId),
        type: {
          in: [
            'DOCUMENT_CREATED',
            'EMAIL_SENT',
            'DOCUMENT_OPENED',
            'DOCUMENT_REJECTED',
            'DOCUMENT_CANCELLED',
            'DOCUMENT_RECIPIENT_COMPLETED',
          ],
        },
      },
      select: {
        name: true,
        email: true,
        ipAddress: true,
        type: true,
        createdAt: true,
        data: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatStatus = (type: string | null | undefined) => {
      if (!type) return null;

      return type
        .toLowerCase()
        .split('_')
        .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
        .join('');
    };

    const toCamelCase = (text: string): string => {
      return text.toLowerCase().replace(/[_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
    };

    const formatDateWithTimeZone = (
      date: Date | string,
      timezone = 'America/Los_Angeles',
      formatOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      },
    ) => {
      return new Intl.DateTimeFormat('en-US', {
        ...formatOptions,
        timeZone: timezone,
      }).format(new Date(date));
    };

    const groupedByEmail = new Map<string, (typeof auditLogs)[number][]>();

    auditLogs.forEach((log) => {
      const data = log.data as AuditLogData;
      const isEmailSent = log.type === 'EMAIL_SENT';

      const effectiveEmail = isEmailSent ? data?.recipientEmail : log.email;

      if (!effectiveEmail) return;

      if (!groupedByEmail.has(effectiveEmail)) {
        groupedByEmail.set(effectiveEmail, []);
      }

      groupedByEmail.get(effectiveEmail)!.push(log);
    });

    const result = Array.from(groupedByEmail.entries()).map(([email, logs]) => {
      const sortedLogs = [...logs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const documentSigned = logs.find((l) => l.type === 'DOCUMENT_RECIPIENT_COMPLETED');

      const emailSent = logs
        .filter((log) => {
          const data = log.data as AuditLogData;
          return log.type === 'EMAIL_SENT' && data?.emailType === 'SIGNING_REQUEST';
        })
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

      const resendEmailSent = logs
        .filter(
          (log) =>
            log.type === 'EMAIL_SENT' &&
            typeof log.data === 'object' &&
            (log.data as AuditLogData)?.isResending === true,
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      const latestEvent = sortedLogs.find((log) => {
        if (log.type !== 'EMAIL_SENT') return true;

        const data = log.data as AuditLogData;
        return data?.emailType === 'SIGNING_REQUEST' || data?.isResending === true;
      });

      const history = sortedLogs
        .filter((log) => {
          const isEmailSent = log.type === 'EMAIL_SENT';
          const isResend = (log.data as AuditLogData)?.isResending === true;
          const isSigningRequest = (log.data as AuditLogData)?.emailType === 'SIGNING_REQUEST';

          if (isEmailSent && !isResend && !isSigningRequest) {
            return false;
          }

          return true;
        })
        .map((log) => {
          const isResend = (log.data as AuditLogData)?.isResending === true;

          let label = log.type;
          if (log.type === 'EMAIL_SENT') {
            label = isResend ? 'resendEmail' : 'emailSent';
          } else {
            label = toCamelCase(log.type);
          }

          return {
            type: label,
            timestamp: format(log.createdAt, 'MM/dd/yyyy'),
            ipAddress: log.ipAddress ?? '',
          };
        })
        .filter(Boolean);

      const signatureStatus: 'signed' | 'notSigned' = documentSigned ? 'signed' : 'notSigned';

      return {
        email,
        name: latestEvent?.name ?? null,
        sendDate: emailSent ? formatDateWithTimeZone(emailSent.createdAt, timezone) : null,
        resendDate: resendEmailSent
          ? formatDateWithTimeZone(resendEmailSent.createdAt, timezone)
          : null,
        signatureDate: documentSigned
          ? formatDateWithTimeZone(documentSigned.createdAt, timezone)
          : null,
        ipAddress: latestEvent?.ipAddress ?? null,
        signatureStatus,
        status: formatStatus(latestEvent?.type),
        history,
      };
    });

    return {
      status: 200,
      body: {
        events: result,
      },
    };
  }),

  downloadSignedDocument: authenticatedMiddleware(async (args, user, team) => {
    const { id: documentId } = args.params;

    try {
      if (process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT !== 's3') {
        return {
          status: 500,
          body: {
            message: 'Please make sure the storage transport is set to S3.',
          },
        };
      }

      const document = await getDocumentById({
        documentId: Number(documentId),
        userId: user.id,
        teamId: team?.id,
      });

      if (!document || !document.documentDataId) {
        return {
          status: 404,
          body: {
            message: 'Document not found',
          },
        };
      }

      if (DocumentDataType.S3_PATH !== document.documentData.type) {
        return {
          status: 400,
          body: {
            message: 'Invalid document data type',
          },
        };
      }

      if (document.status !== DocumentStatus.COMPLETED) {
        return {
          status: 400,
          body: {
            message: 'Document is not completed yet.',
          },
        };
      }

      const { url } = await getPresignGetUrl(document.documentData.data);

      return {
        status: 200,
        body: { downloadUrl: url },
      };
    } catch (err) {
      return {
        status: 500,
        body: {
          message: 'Error downloading the document. Please try again.',
        },
      };
    }
  }),

  deleteDocument: authenticatedMiddleware(async (args, user, team, { metadata }) => {
    const { id: documentId } = args.params;

    try {
      const document = await getDocumentById({
        documentId: Number(documentId),
        userId: user.id,
        teamId: team?.id,
      });

      if (!document) {
        return {
          status: 404,
          body: {
            message: 'Document not found',
          },
        };
      }

      const deletedDocument = await deleteDocument({
        id: document.id,
        userId: user.id,
        teamId: team?.id,
        requestMetadata: metadata,
      });

      return {
        status: 200,
        body: deletedDocument,
      };
    } catch (err) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }
  }),

  createDocument: authenticatedMiddleware(async (args, user, team, { metadata }) => {
    const { body } = args;

    try {
      if (process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT !== 's3') {
        return {
          status: 500,
          body: {
            message: 'Create document is not available without S3 transport.',
          },
        };
      }

      const dateFormat = body.meta.dateFormat
        ? DATE_FORMATS.find((format) => format.value === body.meta.dateFormat)
        : DATE_FORMATS.find((format) => format.value === DEFAULT_DOCUMENT_DATE_FORMAT);

      if (body.meta.dateFormat && !dateFormat) {
        return {
          status: 400,
          body: {
            message: 'Invalid date format. Please provide a valid date format',
          },
        };
      }

      const timezone = body.meta.timezone
        ? TIME_ZONES.find((tz) => tz === body.meta.timezone)
        : DEFAULT_DOCUMENT_TIME_ZONE;

      const isTimeZoneValid = body.meta.timezone ? TIME_ZONES.includes(String(timezone)) : true;

      if (!isTimeZoneValid) {
        return {
          status: 400,
          body: {
            message: 'Invalid timezone. Please provide a valid timezone',
          },
        };
      }

      const fileName = body.title.endsWith('.pdf') ? body.title : `${body.title}.pdf`;

      const { url, key } = await getPresignPostUrl(fileName, 'application/pdf');

      const documentData = await createDocumentData({
        data: key,
        type: DocumentDataType.S3_PATH,
      });

      const document = await createDocument({
        title: body.title,
        externalId: body.externalId || null,
        userId: user.id,
        teamId: team?.id,
        formValues: body.formValues,
        documentDataId: documentData.id,
        requestMetadata: metadata,
      });

      await upsertDocumentMeta({
        documentId: document.id,
        userId: user.id,
        teamId: team?.id,
        subject: body.meta.subject,
        message: body.meta.message,
        timezone,
        dateFormat: dateFormat?.value,
        redirectUrl: body.meta.redirectUrl,
        signingOrder: body.meta.signingOrder,
        language: body.meta.language,
        typedSignatureEnabled: body.meta.typedSignatureEnabled,
        distributionMethod: body.meta.distributionMethod,
        emailSettings: body.meta.emailSettings,
        requestMetadata: metadata,
      });

      if (body.authOptions) {
        await updateDocumentSettings({
          documentId: document.id,
          userId: user.id,
          teamId: team?.id,
          data: {
            ...body.authOptions,
          },
          requestMetadata: metadata,
        });
      }

      const { recipients } = await setDocumentRecipients({
        userId: user.id,
        teamId: team?.id,
        documentId: document.id,
        recipients: body.recipients,
        requestMetadata: metadata,
      });

      return {
        status: 200,
        body: {
          uploadUrl: url,
          documentId: document.id,
          recipients: recipients.map((recipient) => ({
            recipientId: recipient.id,
            name: recipient.name,
            email: recipient.email,
            token: recipient.token,
            role: recipient.role,
            signingOrder: recipient.signingOrder,

            signingUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`,
          })),
        },
      };
    } catch (err) {
      return {
        status: 404,
        body: {
          message: 'An error has occured while uploading the file',
        },
      };
    }
  }),

  deleteTemplate: authenticatedMiddleware(async (args, user, team) => {
    const { id: templateId } = args.params;

    try {
      const deletedTemplate = await deleteTemplate({
        id: Number(templateId),
        userId: user.id,
        teamId: team?.id,
      });

      return {
        status: 200,
        body: deletedTemplate,
      };
    } catch (err) {
      return {
        status: 404,
        body: {
          message: 'Template not found',
        },
      };
    }
  }),

  getTemplate: authenticatedMiddleware(async (args, user, team) => {
    const { id: templateId } = args.params;

    try {
      const template = await getTemplateById({
        id: Number(templateId),
        userId: user.id,
        teamId: team?.id,
      });

      return {
        status: 200,
        body: {
          ...template,
          Field: template.fields.map((field) => ({
            ...field,
            fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : null,
          })),
          Recipient: template.recipients,
        },
      };
    } catch (err) {
      return AppError.toRestAPIError(err);
    }
  }),

  getTemplates: authenticatedMiddleware(async (args, user, team) => {
    const page = Number(args.query.page) || 1;
    const perPage = Number(args.query.perPage) || 10;

    try {
      const { data: templates, totalPages } = await findTemplates({
        page,
        perPage,
        userId: user.id,
        teamId: team?.id,
      });

      return {
        status: 200,
        body: {
          templates: templates.map((template) => ({
            ...template,
            Field: template.fields.map((field) => ({
              ...field,
              fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : null,
            })),
            Recipient: template.recipients,
          })),
          totalPages,
        },
      };
    } catch (err) {
      return AppError.toRestAPIError(err);
    }
  }),

  createTemplate: authenticatedMiddleware(async (args, user, team) => {
    const { body } = args;
    const templateIdToClone = body.templateId;

    try {
      const fileName = body.title.endsWith('.pdf') ? body.title : `${body.title}.pdf`;
      const { id: templateDocumentDataId } = await createDocumentData({
        type: body.type,
        data: body.data,
      });

      const createdTemplate = await createTemplate({
        userId: user.id,
        teamId: team?.id,
        title: fileName,
        formKey: body.title,
        templateDocumentDataId,
      });

      if (templateIdToClone) {
        const originalTemplate = await prisma.template.findUnique({
          where: { id: templateIdToClone },
          include: {
            recipients: { include: { fields: true } },
            templateMeta: true,
          },
        });

        if (!originalTemplate) {
          return { status: 404, body: { message: 'Original template not found' } };
        }

        for (const recipient of originalTemplate.recipients) {
          const clonedRecipient = await prisma.recipient.create({
            data: {
              email: recipient.email,
              name: recipient.name,
              token: nanoid(),
              expired: recipient.expired,
              readStatus: recipient.readStatus,
              signingStatus: recipient.signingStatus,
              sendStatus: recipient.sendStatus,
              signedAt: recipient.signedAt,
              role: recipient.role,
              templateId: createdTemplate.id,
              authOptions: recipient.authOptions ?? Prisma.JsonNull,
              signingOrder: recipient.signingOrder,
              rejectionReason: recipient.rejectionReason,
            },
          });

          for (const originalField of recipient.fields) {
            await prisma.field.create({
              data: {
                templateId: createdTemplate.id,
                recipientId: clonedRecipient.id,
                type: originalField.type,
                page: originalField.page,
                positionX: originalField.positionX,
                positionY: originalField.positionY,
                width: originalField.width,
                height: originalField.height,
                customText: originalField.customText,
                inserted: originalField.inserted,
                fieldMeta: originalField.fieldMeta ?? Prisma.JsonNull,
              },
            });
          }
        }

        if (originalTemplate.templateMeta) {
          const {
            id: _,
            templateId: __,
            emailSettings,
            ...restMetaData
          } = originalTemplate.templateMeta;

          await prisma.templateMeta.create({
            data: {
              templateId: createdTemplate.id,
              ...restMetaData,
              emailSettings: emailSettings ?? Prisma.JsonNull,
            },
          });
        }
      }

      return {
        status: 200,
        body: createdTemplate,
      };
    } catch (err) {
      return {
        status: 404,
        body: {
          message: 'Template not found',
        },
      };
    }
  }),

  createDocumentFromTemplate: authenticatedMiddleware(async (args, user, team, { metadata }) => {
    const { body, params } = args;
    const templateId = Number(params.templateId);

    const fileName = body.title.endsWith('.pdf') ? body.title : `${body.title}.pdf`;

    const document = await createDocumentFromTemplateLegacy({
      templateId,
      userId: user.id,
      teamId: team?.id,
      recipients: body.recipients,
    });

    let documentDataId = document.documentDataId;

    if (body.formValues) {
      const pdf = await getFile(document.documentData);

      const prefilled = await insertFormValuesInPdf({
        pdf: Buffer.from(pdf),
        formValues: body.formValues,
      });

      const newDocumentData = await putPdfFile({
        name: fileName,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(prefilled),
      });

      documentDataId = newDocumentData.id;
    }

    await updateDocument({
      documentId: document.id,
      userId: user.id,
      teamId: team?.id,
      data: {
        title: fileName,
        externalId: body.externalId || null,
        formValues: body.formValues,
        documentData: {
          connect: {
            id: documentDataId,
          },
        },
      },
    });

    if (body.meta) {
      await upsertDocumentMeta({
        documentId: document.id,
        userId: user.id,
        teamId: team?.id,
        ...body.meta,
        requestMetadata: metadata,
      });
    }

    if (body.authOptions) {
      await updateDocumentSettings({
        documentId: document.id,
        userId: user.id,
        teamId: team?.id,
        data: body.authOptions,
        requestMetadata: metadata,
      });
    }

    return {
      status: 200,
      body: {
        documentId: document.id,
        recipients: document.recipients.map((recipient) => ({
          recipientId: recipient.id,
          name: recipient.name,
          email: recipient.email,
          token: recipient.token,
          role: recipient.role,
          signingOrder: recipient.signingOrder,

          signingUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`,
        })),
      },
    };
  }),

  generateDocumentFromTemplate: authenticatedMiddleware(async (args, user, team, { metadata }) => {
    const { body, params } = args;
    const templateId = Number(params.templateId);

    let document: Awaited<ReturnType<typeof createDocumentFromTemplate>> | null = null;

    try {
      let customDocumentDataId: string | undefined;
      if (body.type && body.data) {
        const newDocumentData = await createDocumentData({
          type: body.type,
          data: body.data,
        });
        customDocumentDataId = newDocumentData.id;
      }

      document = await createDocumentFromTemplate({
        templateId,
        externalId: body.externalId || null,
        userId: user.id,
        teamId: team?.id,
        recipients: body.recipients,
        customDocumentDataId,
        override: {
          title: body.title,
          ...body.meta,
        },
        requestMetadata: metadata,
        formKey: body.formKey,
        residentId: body.residentId,
        documentDetails: body.documentDetails,
      });
    } catch (err) {
      return AppError.toRestAPIError(err);
    }

    if (body.formValues) {
      const fileName = document.title.endsWith('.pdf') ? document.title : `${document.title}.pdf`;

      const pdf = await getFile(document.documentData);

      const prefilled = await insertFormValuesInPdf({
        pdf: Buffer.from(pdf),
        formValues: body.formValues,
      });

      const newDocumentData = await putPdfFile({
        name: fileName,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(prefilled),
      });

      await updateDocument({
        documentId: document.id,
        userId: user.id,
        teamId: team?.id,
        data: {
          formValues: body.formValues,
          documentData: {
            connect: {
              id: newDocumentData.id,
            },
          },
        },
      });
    }

    if (body.authOptions) {
      await updateDocumentSettings({
        documentId: document.id,
        userId: user.id,
        teamId: team?.id,
        data: body.authOptions,
        requestMetadata: metadata,
      });
    }

    if (body.distributeDocument) {
      try {
        await sendDocument({
          documentId: document.id,
          userId: user.id,
          teamId: team?.id,
          requestMetadata: metadata,
        });
      } catch (err) {
        console.error('Error sending document:', err);
        return {
          status: 500,
          body: {
            error: 'DOCUMENT_SEND_FAILED',
            message: 'Document was created but failed to be sent.',
          },
        };
      }
    }

    return {
      status: 200,
      body: {
        documentId: document.id,
        recipients: document.recipients.map((recipient) => ({
          recipientId: recipient.id,
          name: recipient.name,
          email: recipient.email,
          token: recipient.token,
          role: recipient.role,
          signingOrder: recipient.signingOrder,
          signingUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`,
        })),
      },
    };
  }),

  sendDocument: authenticatedMiddleware(async (args, user, team, { metadata }) => {
    const { id: documentId } = args.params;
    const { sendEmail, sendCompletionEmails } = args.body;

    try {
      const document = await getDocumentById({
        documentId: Number(documentId),
        userId: user.id,
        teamId: team?.id,
      });

      if (!document) {
        return {
          status: 404,
          body: {
            message: 'Document not found',
          },
        };
      }

      if (document.status === DocumentStatus.COMPLETED) {
        return {
          status: 400,
          body: {
            message: 'Document is already complete',
          },
        };
      }

      const emailSettings = extractDerivedDocumentEmailSettings(document.documentMeta);

      // Update document email settings if sendCompletionEmails is provided
      if (typeof sendCompletionEmails === 'boolean') {
        await upsertDocumentMeta({
          documentId: document.id,
          userId: user.id,
          teamId: team?.id,
          emailSettings: {
            ...emailSettings,
            documentCompleted: sendCompletionEmails,
            ownerDocumentCompleted: sendCompletionEmails,
          },
          requestMetadata: metadata,
        });
      }

      const { recipients, ...sentDocument } = await sendDocument({
        documentId: document.id,
        userId: user.id,
        teamId: team?.id,
        sendEmail,
        requestMetadata: metadata,
      });

      return {
        status: 200,
        body: {
          message: 'Document sent for signing successfully',
          ...sentDocument,
          recipients: recipients.map((recipient) => ({
            ...recipient,
            signingUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`,
          })),
        },
      };
    } catch (err) {
      return {
        status: 500,
        body: {
          message: 'An error has occured while sending the document for signing',
        },
      };
    }
  }),

  resendDocument: authenticatedMiddleware(async (args, user, team, { metadata }) => {
    const { id: documentId } = args.params;
    const { recipients } = args.body;

    try {
      await resendDocument({
        userId: user.id,
        documentId: Number(documentId),
        recipients,
        teamId: team?.id,
        requestMetadata: metadata,
      });

      return {
        status: 200,
        body: {
          message: 'Document resend successfully initiated',
        },
      };
    } catch (err) {
      return {
        status: 500,
        body: {
          message: 'An error has occured while resending the document',
        },
      };
    }
  }),

  resendDocumentByEmail: authenticatedMiddleware(async (args, user, team, { metadata }) => {
    const { id: documentId } = args.params;
    const { recipientEmail } = args.body;

    if (!recipientEmail) {
      return {
        status: 400,
        body: {
          message: 'Missing recipient email',
        },
      };
    }

    try {
      await resendDocument({
        userId: user.id,
        documentId: Number(documentId),
        recipients: [],
        recipientEmail: recipientEmail,
        teamId: team?.id,
        requestMetadata: metadata,
      });

      return {
        status: 200,
        body: {
          message: 'Document resend successfully initiated',
        },
      };
    } catch (err) {
      return {
        status: 500,
        body: {
          message: 'An error occurred while resending the document',
        },
      };
    }
  }),

  createRecipient: authenticatedMiddleware(async (args, user, team, { metadata }) => {
    const { id: documentId } = args.params;
    const { name, email, role, authOptions, signingOrder } = args.body;

    const document = await getDocumentById({
      documentId: Number(documentId),
      userId: user.id,
      teamId: team?.id,
    });

    if (!document) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    if (document.status === DocumentStatus.COMPLETED) {
      return {
        status: 400,
        body: {
          message: 'Document is already completed',
        },
      };
    }

    const recipients = await getRecipientsForDocument({
      documentId: Number(documentId),
      userId: user.id,
      teamId: team?.id,
    });

    const recipientAlreadyExists = recipients.some((recipient) => recipient.email === email);

    if (recipientAlreadyExists) {
      return {
        status: 400,
        body: {
          message: 'Recipient already exists',
        },
      };
    }

    try {
      const { recipients: newRecipients } = await setDocumentRecipients({
        documentId: Number(documentId),
        userId: user.id,
        teamId: team?.id,
        recipients: [
          ...recipients.map(({ email, name }) => ({
            email,
            name,
            role,
          })),
          {
            email,
            name,
            role,
            signingOrder,
            actionAuth: authOptions?.actionAuth ?? null,
          },
        ],
        requestMetadata: metadata,
      });

      const newRecipient = newRecipients.find((recipient) => recipient.email === email);

      if (!newRecipient) {
        throw new Error('Recipient not found');
      }

      return {
        status: 200,
        body: {
          ...newRecipient,
          documentId: Number(documentId),
          signingUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${newRecipient.token}`,
        },
      };
    } catch (err) {
      return {
        status: 500,
        body: {
          message: 'An error has occured while creating the recipient',
        },
      };
    }
  }),

  updateRecipient: authenticatedMiddleware(async (args, user, team) => {
    const { id: documentId, recipientId } = args.params;
    const { name, email, role, authOptions, signingOrder } = args.body;

    const document = await getDocumentById({
      documentId: Number(documentId),
      userId: user.id,
      teamId: team?.id,
    });

    if (!document) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    if (document.status === DocumentStatus.COMPLETED) {
      return {
        status: 400,
        body: {
          message: 'Document is already completed',
        },
      };
    }

    const updatedRecipient = await updateRecipient({
      documentId: Number(documentId),
      recipientId: Number(recipientId),
      userId: user.id,
      teamId: team?.id,
      email,
      name,
      role,
      signingOrder,
      actionAuth: authOptions?.actionAuth,
      requestMetadata: extractNextApiRequestMetadata(args.req),
    }).catch(() => null);

    if (!updatedRecipient) {
      return {
        status: 404,
        body: {
          message: 'Recipient not found',
        },
      };
    }

    return {
      status: 200,
      body: {
        ...updatedRecipient,
        documentId: Number(documentId),
        signingUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${updatedRecipient.token}`,
      },
    };
  }),

  deleteRecipient: authenticatedMiddleware(async (args, user, team) => {
    const { id: documentId, recipientId } = args.params;

    const document = await getDocumentById({
      documentId: Number(documentId),
      userId: user.id,
      teamId: team?.id,
    });

    if (!document) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    if (document.status === DocumentStatus.COMPLETED) {
      return {
        status: 400,
        body: {
          message: 'Document is already completed',
        },
      };
    }

    const deletedRecipient = await deleteRecipient({
      documentId: Number(documentId),
      recipientId: Number(recipientId),
      userId: user.id,
      teamId: team?.id,
      requestMetadata: extractNextApiRequestMetadata(args.req),
    }).catch(() => null);

    if (!deletedRecipient) {
      return {
        status: 400,
        body: {
          message: 'Unable to delete recipient',
        },
      };
    }

    return {
      status: 200,
      body: {
        ...deletedRecipient,
        documentId: Number(documentId),
        signingUrl: '',
      },
    };
  }),

  createField: authenticatedMiddleware(async (args, user, team) => {
    const { id: documentId } = args.params;
    const fields = Array.isArray(args.body) ? args.body : [args.body];

    const document = await prisma.document.findFirst({
      select: { id: true, status: true },
      where: {
        id: Number(documentId),
        ...(team?.id
          ? {
              team: {
                id: team.id,
                members: { some: { userId: user.id } },
              },
            }
          : {
              userId: user.id,
              teamId: null,
            }),
      },
    });

    if (!document) {
      return {
        status: 404,
        body: { message: 'Document not found' },
      };
    }

    if (document.status === DocumentStatus.COMPLETED) {
      return {
        status: 400,
        body: { message: 'Document is already completed' },
      };
    }

    try {
      const createdFields = await prisma.$transaction(async (tx) => {
        return Promise.all(
          fields.map(async (fieldData) => {
            const {
              recipientId,
              type,
              pageNumber,
              pageWidth,
              pageHeight,
              pageX,
              pageY,
              fieldMeta,
            } = fieldData;

            if (pageNumber <= 0) {
              throw new Error('Invalid page number');
            }

            const recipient = await getRecipientByIdV1Api({
              id: Number(recipientId),
              documentId: Number(documentId),
            }).catch(() => null);

            if (!recipient) {
              throw new Error('Recipient not found');
            }

            if (recipient.signingStatus === SigningStatus.SIGNED) {
              throw new Error('Recipient has already signed the document');
            }

            const advancedField = ['NUMBER', 'RADIO', 'CHECKBOX', 'DROPDOWN', 'TEXT'].includes(
              type,
            );

            if (advancedField && !fieldMeta) {
              throw new Error(
                'Field meta is required for this type of field. Please provide the appropriate field meta object.',
              );
            }

            if (fieldMeta && fieldMeta.type.toLowerCase() !== String(type).toLowerCase()) {
              throw new Error('Field meta type does not match the field type');
            }

            const result = match(type)
              .with('RADIO', () => ZRadioFieldMeta.safeParse(fieldMeta))
              .with('CHECKBOX', () => ZCheckboxFieldMeta.safeParse(fieldMeta))
              .with('DROPDOWN', () => ZDropdownFieldMeta.safeParse(fieldMeta))
              .with('NUMBER', () => ZNumberFieldMeta.safeParse(fieldMeta))
              .with('TEXT', () => ZTextFieldMeta.safeParse(fieldMeta))
              .with('SIGNATURE', 'INITIALS', 'DATE', 'EMAIL', 'NAME', 'CALENDAR', () => ({
                success: true,
                data: undefined,
              }))
              .with('FREE_SIGNATURE', () => ({
                success: false,
                error: 'FREE_SIGNATURE is not supported',
                data: undefined,
              }))
              .exhaustive();

            if (!result.success) {
              throw new Error('Field meta parsing failed');
            }

            const field = await tx.field.create({
              data: {
                documentId: Number(documentId),
                recipientId: Number(recipientId),
                type,
                page: pageNumber,
                positionX: pageX,
                positionY: pageY,
                width: pageWidth,
                height: pageHeight,
                customText: '',
                inserted: false,
                fieldMeta: result.data,
              },
              include: {
                recipient: true,
              },
            });

            await tx.documentAuditLog.create({
              data: createDocumentAuditLogData({
                type: 'FIELD_CREATED',
                documentId: Number(documentId),
                user: {
                  id: team?.id ?? user.id,
                  email: team?.name ?? user.email,
                  name: team ? '' : user.name,
                },
                data: {
                  fieldId: field.secondaryId,
                  fieldRecipientEmail: field.recipient?.email ?? '',
                  fieldRecipientId: recipientId,
                  fieldType: field.type,
                },
                requestMetadata: extractNextApiRequestMetadata(args.req),
              }),
            });

            return {
              id: field.id,
              documentId: Number(field.documentId),
              recipientId: field.recipientId ?? -1,
              type: field.type,
              pageNumber: field.page,
              pageX: Number(field.positionX),
              pageY: Number(field.positionY),
              pageWidth: Number(field.width),
              pageHeight: Number(field.height),
              customText: field.customText,
              fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined,
              inserted: field.inserted,
            };
          }),
        );
      });

      return {
        status: 200,
        body: {
          fields: createdFields,
          documentId: Number(documentId),
        },
      };
    } catch (err) {
      return AppError.toRestAPIError(err);
    }
  }),

  updateField: authenticatedMiddleware(async (args, user, team) => {
    const { id: documentId, fieldId } = args.params;
    const { recipientId, type, pageNumber, pageWidth, pageHeight, pageX, pageY, fieldMeta } =
      args.body;

    const document = await getDocumentById({
      documentId: Number(documentId),
      userId: user.id,
      teamId: team?.id,
    });

    if (!document) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    if (document.status === DocumentStatus.COMPLETED) {
      return {
        status: 400,
        body: {
          message: 'Document is already completed',
        },
      };
    }

    const recipient = await getRecipientByIdV1Api({
      id: Number(recipientId),
      documentId: Number(documentId),
    }).catch(() => null);

    if (!recipient) {
      return {
        status: 404,
        body: {
          message: 'Recipient not found',
        },
      };
    }

    if (recipient.signingStatus === SigningStatus.SIGNED) {
      return {
        status: 400,
        body: {
          message: 'Recipient has already signed the document',
        },
      };
    }

    const updatedField = await updateField({
      fieldId: Number(fieldId),
      userId: user.id,
      teamId: team?.id,
      documentId: Number(documentId),
      recipientId: recipientId ? Number(recipientId) : undefined,
      type,
      pageNumber,
      pageX,
      pageY,
      pageWidth,
      pageHeight,
      requestMetadata: extractNextApiRequestMetadata(args.req),
      fieldMeta: fieldMeta ? ZFieldMetaSchema.parse(fieldMeta) : undefined,
    });

    const remappedField = {
      id: updatedField.id,
      documentId: updatedField.documentId,
      recipientId: updatedField.recipientId ?? -1,
      type: updatedField.type,
      pageNumber: updatedField.page,
      pageX: Number(updatedField.positionX),
      pageY: Number(updatedField.positionY),
      pageWidth: Number(updatedField.width),
      pageHeight: Number(updatedField.height),
      customText: updatedField.customText,
      inserted: updatedField.inserted,
    };

    return {
      status: 200,
      body: {
        ...remappedField,
        documentId: Number(documentId),
      },
    };
  }),

  deleteField: authenticatedMiddleware(async (args, user, team) => {
    const { id: documentId, fieldId } = args.params;

    const document = await getDocumentById({
      documentId: Number(documentId),
      userId: user.id,
    });

    if (!document) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    if (document.status === DocumentStatus.COMPLETED) {
      return {
        status: 400,
        body: {
          message: 'Document is already completed',
        },
      };
    }

    const field = await getFieldById({
      userId: user.id,
      teamId: team?.id,
      fieldId: Number(fieldId),
      documentId: Number(documentId),
    }).catch(() => null);

    if (!field) {
      return {
        status: 404,
        body: {
          message: 'Field not found',
        },
      };
    }

    const recipient = await getRecipientByIdV1Api({
      id: Number(field.recipientId),
      documentId: Number(documentId),
    }).catch(() => null);

    if (recipient?.signingStatus === SigningStatus.SIGNED) {
      return {
        status: 400,
        body: {
          message: 'Recipient has already signed the document',
        },
      };
    }

    const deletedField = await deleteField({
      documentId: Number(documentId),
      fieldId: Number(fieldId),
      userId: user.id,
      teamId: team?.id,
      requestMetadata: extractNextApiRequestMetadata(args.req),
    }).catch(() => null);

    if (!deletedField) {
      return {
        status: 400,
        body: {
          message: 'Unable to delete field',
        },
      };
    }

    const remappedField = {
      id: deletedField.id,
      documentId: deletedField.documentId,
      recipientId: deletedField.recipientId ?? -1,
      type: deletedField.type,
      pageNumber: deletedField.page,
      pageX: Number(deletedField.positionX),
      pageY: Number(deletedField.positionY),
      pageWidth: Number(deletedField.width),
      pageHeight: Number(deletedField.height),
      customText: deletedField.customText,
      inserted: deletedField.inserted,
    };

    return {
      status: 200,
      body: {
        ...remappedField,
        documentId: Number(documentId),
      },
    };
  }),

  findTeamMembers: authenticatedMiddleware(async (args, user, team) => {
    const { id: teamId } = args.params;

    if (team?.id !== Number(teamId)) {
      return {
        status: 403,
        body: {
          message: 'You are not authorized to perform actions against this team.',
        },
      };
    }

    const self = await prisma.teamMember.findFirst({
      where: {
        userId: user.id,
        teamId: team.id,
      },
    });

    if (self?.role !== TeamMemberRole.ADMIN) {
      return {
        status: 403,
        body: {
          message: 'You are not authorized to perform actions against this team.',
        },
      };
    }

    const members = await prisma.teamMember.findMany({
      where: {
        teamId: team.id,
      },
      include: {
        user: true,
      },
    });

    return {
      status: 200,
      body: {
        members: members.map((member) => ({
          id: member.id,
          email: member.user.email,
          role: member.role,
        })),
      },
    };
  }),

  inviteTeamMember: authenticatedMiddleware(async (args, user, team) => {
    const { id: teamId } = args.params;

    const { email, role } = args.body;

    if (team?.id !== Number(teamId)) {
      return {
        status: 403,
        body: {
          message: 'You are not authorized to perform actions against this team.',
        },
      };
    }

    const self = await prisma.teamMember.findFirst({
      where: {
        userId: user.id,
        teamId: team.id,
      },
    });

    if (self?.role !== TeamMemberRole.ADMIN) {
      return {
        status: 403,
        body: {
          message: 'You are not authorized to perform actions against this team.',
        },
      };
    }

    const hasAlreadyBeenInvited = await prisma.teamMember.findFirst({
      where: {
        teamId: team.id,
        user: {
          email,
        },
      },
    });

    if (hasAlreadyBeenInvited) {
      return {
        status: 400,
        body: {
          message: 'This user has already been invited to the team',
        },
      };
    }

    await createTeamMemberInvites({
      userId: user.id,
      userName: user.name ?? '',
      teamId: team.id,
      invitations: [
        {
          email,
          role,
        },
      ],
    });

    return {
      status: 200,
      body: {
        message: 'An invite has been sent to the member',
      },
    };
  }),

  updateTeamMember: authenticatedMiddleware(async (args, user, team) => {
    const { id: teamId, memberId } = args.params;

    const { role } = args.body;

    if (team?.id !== Number(teamId)) {
      return {
        status: 403,
        body: {
          message: 'You are not authorized to perform actions against this team.',
        },
      };
    }

    const self = await prisma.teamMember.findFirst({
      where: {
        userId: user.id,
        teamId: team.id,
      },
    });

    if (self?.role !== TeamMemberRole.ADMIN) {
      return {
        status: 403,
        body: {
          message: 'You are not authorized to perform actions against this team.',
        },
      };
    }

    const member = await prisma.teamMember.findFirst({
      where: {
        id: Number(memberId),
        teamId: team.id,
      },
    });

    if (!member) {
      return {
        status: 404,
        body: {
          message: 'The provided member id does not exist.',
        },
      };
    }

    const updatedMember = await prisma.teamMember.update({
      where: {
        id: member.id,
      },
      data: {
        role,
      },
      include: {
        user: true,
      },
    });

    return {
      status: 200,
      body: {
        id: updatedMember.id,
        email: updatedMember.user.email,
        role: updatedMember.role,
      },
    };
  }),

  removeTeamMember: authenticatedMiddleware(async (args, user, team) => {
    const { id: teamId, memberId } = args.params;

    if (team?.id !== Number(teamId)) {
      return {
        status: 403,
        body: {
          message: 'You are not authorized to perform actions against this team.',
        },
      };
    }

    const self = await prisma.teamMember.findFirst({
      where: {
        userId: user.id,
        teamId: team.id,
      },
    });

    if (self?.role !== TeamMemberRole.ADMIN) {
      return {
        status: 403,
        body: {
          message: 'You are not authorized to perform actions against this team.',
        },
      };
    }

    const member = await prisma.teamMember.findFirst({
      where: {
        id: Number(memberId),
        teamId: Number(teamId),
      },
      include: {
        user: true,
      },
    });

    if (!member) {
      return {
        status: 404,
        body: {
          message: 'Member not found',
        },
      };
    }

    if (team.ownerUserId === member.userId) {
      return {
        status: 403,
        body: {
          message: 'You cannot remove the owner of the team',
        },
      };
    }

    if (member.userId === user.id) {
      return {
        status: 403,
        body: {
          message: 'You cannot remove yourself from the team',
        },
      };
    }

    await deleteTeamMembers({
      userId: user.id,
      teamId: team.id,
      teamMemberIds: [member.id],
    });

    return {
      status: 200,
      body: {
        id: member.id,
        email: member.user.email,
        role: member.role,
      },
    };
  }),
});

const updateDocument = async ({
  documentId,
  userId,
  teamId,
  data,
}: {
  documentId: number;
  data: Prisma.DocumentUpdateInput;
  userId: number;
  teamId?: number;
}) => {
  return await prisma.document.update({
    where: {
      id: documentId,
      ...(teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          }),
    },
    data: {
      ...data,
    },
  });
};
