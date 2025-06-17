import { type TFieldMetaSchema as FieldMeta } from '@documenso/lib/types/field-meta';
import type { Field, Signature } from '@documenso/prisma/client';

export type TypedSignatureSettings = {
  font?: string;
  color?: string;
};

export type SignatureWithSettings = Signature & {
  typedSignatureSettings?: TypedSignatureSettings | null;
};

export type FieldWithSignature = Field & {
  signature?: Signature | null;
  fieldMeta?: FieldMeta | null;
};
