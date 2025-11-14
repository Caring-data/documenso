import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/macro';
import { z } from 'zod';

import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { FieldType } from '@documenso/prisma/client';

export const ZDocumentFlowFormSchema = z.object({
  title: z.string().min(1),

  signers: z
    .array(
      z.object({
        formId: z.string().min(1),
        nativeId: z.number().optional(),
        email: z.string().min(1).email(),
        name: z.string(),
      }),
    )
    .refine((signers) => {
      const emails = signers.map((signer) => signer.email);
      return new Set(emails).size === emails.length;
    }, 'Signers must have unique emails'),

  fields: z.array(
    z.object({
      formId: z.string().min(1),
      nativeId: z.number().optional(),
      type: z.nativeEnum(FieldType),
      signerEmail: z.string().min(1).optional(),
      pageNumber: z.number().min(1),
      pageX: z.number().min(0),
      pageY: z.number().min(0),
      pageWidth: z.number().min(0),
      pageHeight: z.number().min(0),
      fieldMeta: ZFieldMetaSchema,
    }),
  ),

  email: z.object({
    subject: z.string(),
    message: z.string(),
  }),
});

export type TDocumentFlowFormSchema = z.infer<typeof ZDocumentFlowFormSchema>;

export const FRIENDLY_FIELD_TYPE: Record<FieldType, MessageDescriptor> = {
  [FieldType.SIGNATURE]: msg`Signature`,
  [FieldType.FREE_SIGNATURE]: msg`Free Signature`,
  [FieldType.INITIALS]: msg`Initials`,
  [FieldType.TEXT]: msg`Text`,
  [FieldType.DATE]: msg`Date`,
  [FieldType.CALENDAR]: msg`Calendar`,
  [FieldType.EMAIL]: msg`Email`,
  [FieldType.NAME]: msg`Name`,
  [FieldType.NUMBER]: msg`Number`,
  [FieldType.RADIO]: msg`Radio`,
  [FieldType.CHECKBOX]: msg`Checkbox`,
  [FieldType.DROPDOWN]: msg`Select`,
  [FieldType.RESIDENT_FIRST_NAME]: msg`R. First Name`,
  [FieldType.RESIDENT_LAST_NAME]: msg`R. Last Name`,
  [FieldType.RESIDENT_DOB]: msg`R. Date of Birth`,
  [FieldType.RESIDENT_GENDER_IDENTITY]: msg`R. Gender Identity`,
  [FieldType.RESIDENT_LOCATION_NAME]: msg`R. L. Name`,
  [FieldType.RESIDENT_LOCATION_STATE]: msg`R. L. State`,
  [FieldType.RESIDENT_LOCATION_ADDRESS]: msg`R. L. Address`,
  [FieldType.RESIDENT_LOCATION_CITY]: msg`R. L. City`,
  [FieldType.RESIDENT_LOCATION_ZIP_CODE]: msg`R. L. Zip Code`,
  [FieldType.RESIDENT_LOCATION_COUNTRY]: msg`R. L. Country`,
  [FieldType.RESIDENT_LOCATION_FAX]: msg`R. L. Fax`,
  [FieldType.RESIDENT_LOCATION_LICENSING]: msg`R. L. Licensing`,
  [FieldType.RESIDENT_LOCATION_LICENSING_NAME]: msg`R. L. Licensee Name`,
  [FieldType.RESIDENT_LOCATION_ADMINISTRATOR_NAME]: msg`R. L. Administrator Name`,
  [FieldType.RESIDENT_LOCATION_ADMINISTRATOR_PHONE]: msg`R. L. Administrator Phone`,
};

export interface DocumentFlowStep {
  title: MessageDescriptor;
  description: MessageDescriptor;
  stepIndex?: number;
  onBackStep?: () => unknown;
  onNextStep?: () => unknown;
}
