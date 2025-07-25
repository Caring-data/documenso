import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import type { DocumentDistributionMethod } from '@documenso/prisma/client';
import {
  DocumentSigningOrder,
  DocumentSource,
  type Field,
  Prisma,
  type Recipient,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@documenso/prisma/client';

import type { SupportedLanguageCodes } from '../../constants/i18n';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { ZRecipientAuthOptionsSchema } from '../../types/document-auth';
import type { TDocumentEmailSettings } from '../../types/document-email';
import { ZFieldMetaSchema } from '../../types/field-meta';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { createLog } from '../../utils/createLog';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import {
  createDocumentAuthOptions,
  createRecipientAuthOptions,
  extractDocumentAuthMethods,
} from '../../utils/document-auth';
import {
  findFieldCoordinatesFromPdf,
  getFieldVariableName,
} from '../../utils/pdf/findFieldCoordinates';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

type FinalRecipient = Pick<
  Recipient,
  'name' | 'email' | 'role' | 'authOptions' | 'signingOrder' | 'expired'
> & {
  templateRecipientId: number;
  fields: Field[];
};

export type CreateDocumentFromTemplateOptions = {
  templateId: number;
  externalId?: string | null;
  userId: number;
  teamId?: number;
  recipients: {
    id: number;
    name?: string;
    email: string;
    signingOrder?: number | null;
    expired?: Date | null;
  }[];
  customDocumentDataId?: string;

  /**
   * Values that will override the predefined values in the template.
   */
  override?: {
    title?: string;
    subject?: string;
    message?: string;
    timezone?: string;
    password?: string;
    dateFormat?: string;
    redirectUrl?: string;
    signingOrder?: DocumentSigningOrder;
    language?: SupportedLanguageCodes;
    distributionMethod?: DocumentDistributionMethod;
    typedSignatureEnabled?: boolean;
    emailSettings?: TDocumentEmailSettings;
  };
  requestMetadata: ApiRequestMetadata;
  formKey?: string;
  residentId?: string;
  documentDetails?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    residentName?: string;
    locationName?: string;
  };
};

export const createDocumentFromTemplate = async ({
  templateId,
  externalId,
  userId,
  teamId,
  recipients,
  customDocumentDataId,
  override,
  requestMetadata,
  formKey,
  residentId,
  documentDetails,
}: CreateDocumentFromTemplateOptions) => {
  const template = await prisma.template.findUnique({
    where: {
      id: templateId,
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
    include: {
      recipients: {
        include: {
          fields: true,
        },
      },
      templateDocumentData: true,
      templateMeta: true,
      team: {
        include: {
          teamGlobalSettings: true,
        },
      },
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  // Check that the template has IDs.
  if (template.recipients.length === 0) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'The template does not contain any recipients.',
    });
  }

  const { documentAuthOption: templateAuthOptions } = extractDocumentAuthMethods({
    documentAuth: template.authOptions,
  });

  const finalRecipients: FinalRecipient[] = template.recipients.map((templateRecipient) => {
    const foundRecipient = recipients.find((recipient) => {
      if (recipient.signingOrder != null && templateRecipient.signingOrder != null) {
        return recipient.signingOrder === templateRecipient.signingOrder;
      }

      return recipient.id === templateRecipient.id;
    });

    return {
      templateRecipientId: templateRecipient.id,
      fields: templateRecipient.fields,
      name: foundRecipient ? (foundRecipient.name ?? '') : templateRecipient.name,
      email: foundRecipient ? foundRecipient.email : templateRecipient.email,
      role: templateRecipient.role,
      signingOrder: foundRecipient?.signingOrder ?? templateRecipient.signingOrder,
      authOptions: templateRecipient.authOptions,
      expired: foundRecipient?.expired ?? templateRecipient?.expired ?? null,
      //id: nanoid(),
    };
  });

  let parentDocumentData = template.templateDocumentData;

  if (customDocumentDataId) {
    const customDocumentData = await prisma.documentData.findFirst({
      where: {
        id: customDocumentDataId,
      },
    });

    if (!customDocumentData) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Custom document data not found',
      });
    }

    parentDocumentData = customDocumentData;
  }

  const documentData = await prisma.documentData.create({
    data: {
      type: parentDocumentData.type,
      data: parentDocumentData.data,
      initialData: parentDocumentData.initialData,
    },
  });

  try {
    return await prisma.$transaction(
      async (tx) => {
        const document = await tx.document.create({
          data: {
            source: DocumentSource.TEMPLATE,
            externalId: externalId || template.externalId,
            templateId: template.id,
            userId,
            teamId: template.teamId,
            title: override?.title || template.title,
            documentDataId: documentData.id,
            authOptions: createDocumentAuthOptions({
              globalAccessAuth: templateAuthOptions.globalAccessAuth,
              globalActionAuth: templateAuthOptions.globalActionAuth,
            }),
            formKey,
            residentId,
            documentDetails,
            visibility:
              template.visibility || template.team?.teamGlobalSettings?.documentVisibility,
            documentMeta: {
              create: {
                subject: override?.subject || template.templateMeta?.subject,
                message: override?.message || template.templateMeta?.message,
                timezone: override?.timezone || template.templateMeta?.timezone,
                password: override?.password || template.templateMeta?.password,
                dateFormat: override?.dateFormat || template.templateMeta?.dateFormat,
                redirectUrl: override?.redirectUrl || template.templateMeta?.redirectUrl,
                distributionMethod:
                  override?.distributionMethod || template.templateMeta?.distributionMethod,
                // last `undefined` is due to JsonValue's
                emailSettings:
                  override?.emailSettings || template.templateMeta?.emailSettings || undefined,
                signingOrder:
                  override?.signingOrder ||
                  template.templateMeta?.signingOrder ||
                  DocumentSigningOrder.PARALLEL,
                language:
                  override?.language ||
                  template.templateMeta?.language ||
                  template.team?.teamGlobalSettings?.documentLanguage,
                typedSignatureEnabled:
                  override?.typedSignatureEnabled ?? template.templateMeta?.typedSignatureEnabled,
              },
            },
            recipients: {
              createMany: {
                data: Object.values(finalRecipients)
                  .filter((recipient) => recipient.email && !recipient.email.includes('recipient'))
                  .map((recipient) => {
                    const authOptions = ZRecipientAuthOptionsSchema.parse(recipient?.authOptions);

                    return {
                      //id: recipient.id,
                      email: recipient.email ?? '',
                      name: recipient.name,
                      role: recipient.role,
                      authOptions: createRecipientAuthOptions({
                        accessAuth: authOptions.accessAuth,
                        actionAuth: authOptions.actionAuth,
                      }),
                      sendStatus:
                        recipient.role === RecipientRole.CC ? SendStatus.SENT : SendStatus.NOT_SENT,
                      signingStatus:
                        recipient.role === RecipientRole.CC
                          ? SigningStatus.SIGNED
                          : SigningStatus.NOT_SIGNED,
                      signingOrder: recipient.signingOrder,
                      token: nanoid(),
                      expired: recipient.expired,
                    };
                  }),
              },
            },
          },
          include: {
            recipients: {
              orderBy: {
                id: 'asc',
              },
            },
            documentData: true,
          },
        });

        if (!document) {
          await createLog({
            action: 'DOCUMENT_CREATION_FAILED',
            message: 'Document could not be created',
            data: { templateId, userId },
            metadata: requestMetadata,
            userId,
          });
        }

        const base64Pdf = documentData.data;
        const fieldsToCreate: Omit<Field, 'id' | 'secondaryId' | 'templateId'>[] = [];
        const variableCounters: Record<string, number> = {};
        const skipCoordinateSearchKeys = [
          'signed_admission_agreement',
          'hospice_agreement',
          'home_health_agreement',
        ];

        const shouldSkipCoordinateSearch =
          template.formKey && skipCoordinateSearchKeys.includes(template.formKey);

        for (const finalRecipient of finalRecipients) {
          const recipient = document.recipients.find(
            (recipient: Recipient) =>
              recipient.email === finalRecipient.email &&
              recipient.signingOrder === finalRecipient.signingOrder,
          );
          if (!recipient) continue;

          for (const field of finalRecipient.fields) {
            let coordinates;

            if (!shouldSkipCoordinateSearch) {
              const variableName = getFieldVariableName(recipient, field);

              const coordinatesList = await findFieldCoordinatesFromPdf({
                base64Pdf,
                fieldName: variableName,
              });

              if (coordinatesList && coordinatesList.length > 0) {
                const index = variableCounters[variableName] ?? 0;
                coordinates = coordinatesList[index] || coordinatesList[0];
                variableCounters[variableName] = index + 1;
              }
            }

            if (!coordinates) {
              coordinates = {
                x: field.positionX,
                y: field.positionY,
                page: field.page,
              };
            }

            fieldsToCreate.push({
              documentId: document.id,
              recipientId: recipient.id,
              type: field.type,
              page: coordinates.page,
              positionX: new Prisma.Decimal(coordinates.x),
              positionY: new Prisma.Decimal(coordinates.y),
              width: field.width,
              height: field.height,
              customText: '',
              inserted: false,
              fieldMeta: field.fieldMeta,
            });
          }
        }

        try {
          await tx.field.createMany({
            data: fieldsToCreate.map((field) => ({
              ...field,
              fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined,
            })),
          });
        } catch (error) {
          await createLog({
            action: 'FIELD_CREATION_FAILED',
            message: 'Error creating fields from template',
            data: {
              error: error instanceof Error ? error.message : String(error),
              documentId: document.id,
              userId,
            },
            metadata: requestMetadata,
            userId,
          });
          throw error;
        }

        await tx.documentAuditLog.create({
          data: createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
            documentId: document.id,
            metadata: requestMetadata,
            data: {
              title: document.title,
              source: {
                type: DocumentSource.TEMPLATE,
                templateId: template.id,
              },
            },
          }),
        });

        const createdDocument = await tx.document.findFirst({
          where: {
            id: document.id,
          },
          include: {
            documentMeta: true,
            recipients: true,
          },
        });

        if (!createdDocument) {
          throw new Error('Document not found');
        }

        await triggerWebhook({
          event: WebhookTriggerEvents.DOCUMENT_CREATED,
          data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(createdDocument)),
          userId,
          teamId,
        });

        return document;
      },
      {
        timeout: 50000,
      },
    );
  } catch (error) {
    await createLog({
      action: 'DOCUMENT_FROM_TEMPLATE_ERROR',
      message: 'Error creating document from template',
      data: {
        error: error instanceof Error ? error.message : String(error),
        templateId,
        userId,
      },
      metadata: requestMetadata,
      userId,
    });
    throw error;
  }
};
