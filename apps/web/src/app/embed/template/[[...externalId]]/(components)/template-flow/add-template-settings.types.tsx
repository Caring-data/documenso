import { z } from 'zod';

import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/i18n';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZRecipientActionAuthTypesSchema } from '@documenso/lib/types/document-auth';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import { isValidRedirectUrl } from '@documenso/lib/utils/is-valid-redirect-url';
import { DocumentSigningOrder, DocumentVisibility, RecipientRole } from '@documenso/prisma/client';
import {
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaTimezoneSchema,
} from '@documenso/trpc/server/document-router/schema';
import { ZMapNegativeOneToUndefinedSchema } from '@documenso/ui/primitives/document-flow/add-settings.types';

import { DocumentDistributionMethod } from '.prisma/client';

export const ZSignerSchema = z.object({
  nativeId: z.number().optional(),
  formId: z.string().min(1),
  name: z.string(),
  email: z.string().min(1).email(),
  role: z.nativeEnum(RecipientRole),
  actionAuth: ZMapNegativeOneToUndefinedSchema.pipe(ZRecipientActionAuthTypesSchema.optional()),
  signingOrder: z.number().optional(),
});

export const ZAddTemplateSettingsFormSchema = z.object({
  title: z.string().trim().min(1, { message: "Title can't be empty" }),
  externalId: z.string().optional(),
  visibility: z.nativeEnum(DocumentVisibility).optional(),
  globalAccessAuth: ZMapNegativeOneToUndefinedSchema.pipe(
    ZDocumentAccessAuthTypesSchema.optional(),
  ),
  globalActionAuth: ZMapNegativeOneToUndefinedSchema.pipe(
    ZDocumentActionAuthTypesSchema.optional(),
  ),

  signingOrder: z.nativeEnum(DocumentSigningOrder).default(DocumentSigningOrder.SEQUENTIAL),
  signers: z
    .array(ZSignerSchema)
    .min(1, { message: 'At least one recipient is required' })
    .refine(
      (signers) => {
        const emails = signers.map((signer) => signer.email.toLowerCase());
        return new Set(emails).size === emails.length;
      },
      // Dirty hack to handle errors when .root is populated for an array type
      { message: 'Signers must have unique emails', path: ['signers__root'] },
    ),

  meta: z.object({
    subject: z.string(),
    message: z.string(),
    timezone: ZDocumentMetaTimezoneSchema.default(DEFAULT_DOCUMENT_TIME_ZONE),
    dateFormat: ZDocumentMetaDateFormatSchema.default(DEFAULT_DOCUMENT_DATE_FORMAT),
    distributionMethod: z
      .nativeEnum(DocumentDistributionMethod)
      .optional()
      .default(DocumentDistributionMethod.EMAIL),
    redirectUrl: z
      .string()
      .optional()
      .refine((value) => value === undefined || value === '' || isValidRedirectUrl(value), {
        message:
          'Please enter a valid URL, make sure you include http:// or https:// part of the url.',
      }),
    language: z
      .union([z.string(), z.enum(SUPPORTED_LANGUAGE_CODES)])
      .optional()
      .default('en'),
    emailSettings: ZDocumentEmailSettingsSchema,
  }),
});

export type TAddTemplateSettingsFormSchema = z.infer<typeof ZAddTemplateSettingsFormSchema>;
export type TSigner = z.infer<typeof ZSignerSchema>;
