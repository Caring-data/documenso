export interface TypedSignatureSettings {
  font?: string;
  color?: string;
}

export function isTypedSignatureSettings(value: unknown): value is TypedSignatureSettings {
  return typeof value === 'object' && value !== null && ('font' in value || 'color' in value);
}
