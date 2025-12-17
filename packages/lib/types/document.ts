import { z } from 'zod';

import {
  DocumentDataSchema,
  DocumentMetaSchema,
  DocumentSchema,
  TeamSchema,
  UserSchema,
} from '@documenso/prisma/generated/zod';

import { ZFieldSchema } from './field';
import { ZRecipientLiteSchema } from './recipient';

export const ZDocumentDetailsSchema = z
  .object({
    companyName: z.string().optional(),
    facilityAdministrator: z.string().optional(),
    documentName: z.string().optional(),
    residentName: z.string().optional(),
    locationName: z.string().optional(),
    formType: z.string().optional(),
  })
  .nullable()
  .optional();

export type TDocumentDetails = z.infer<typeof ZDocumentDetailsSchema>;

/**
 * The full document response schema.
 *
 * Mainly used for returning a single document from the API.
 */
export const ZDocumentSchema = DocumentSchema.pick({
  visibility: true,
  status: true,
  source: true,
  id: true,
  externalId: true,
  userId: true,
  authOptions: true,
  formValues: true,
  title: true,
  documentDataId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  deletedAt: true,
  teamId: true,
  templateId: true,
  formKey: true,
  residentId: true,
  activityStatus: true,
}).extend({
  // Todo: Maybe we want to alter this a bit since this returns a lot of data.
  documentData: DocumentDataSchema.pick({
    type: true,
    id: true,
    data: true,
    initialData: true,
  }),
  documentMeta: DocumentMetaSchema.pick({
    signingOrder: true,
    distributionMethod: true,
    id: true,
    subject: true,
    message: true,
    timezone: true,
    password: true,
    dateFormat: true,
    documentId: true,
    redirectUrl: true,
    typedSignatureEnabled: true,
    language: true,
    emailSettings: true,
  }).nullable(),
  recipients: ZRecipientLiteSchema.array(),
  fields: ZFieldSchema.array(),
  documentDetails: ZDocumentDetailsSchema,
});

export type TDocument = z.infer<typeof ZDocumentSchema>;

/**
 * A lite version of the document response schema without relations.
 */
export const ZDocumentLiteSchema = DocumentSchema.pick({
  visibility: true,
  status: true,
  source: true,
  id: true,
  externalId: true,
  userId: true,
  authOptions: true,
  formValues: true,
  title: true,
  documentDataId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  deletedAt: true,
  teamId: true,
  templateId: true,
  formKey: true,
  residentId: true,
  activityStatus: true,
}).extend({
  documentDetails: ZDocumentDetailsSchema,
});

/**
 * A version of the document response schema when returning multiple documents at once from a single API endpoint.
 */
export const ZDocumentManySchema = DocumentSchema.pick({
  visibility: true,
  status: true,
  source: true,
  id: true,
  externalId: true,
  userId: true,
  authOptions: true,
  formValues: true,
  title: true,
  documentDataId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  deletedAt: true,
  teamId: true,
  templateId: true,
  formKey: true,
  residentId: true,
  activityStatus: true,
  documentUrl: true,
}).extend({
  user: UserSchema.pick({
    id: true,
    name: true,
    email: true,
  }),
  recipients: ZRecipientLiteSchema.array(),
  team: TeamSchema.pick({
    id: true,
    url: true,
  }).nullable(),
  documentDetails: ZDocumentDetailsSchema,
});
