import type { TCalendarFieldMeta as CalendarFieldMeta } from '../types/field-meta';

export const validateCalendarField = (fieldMeta: CalendarFieldMeta): string[] => {
  const errors: string[] = [];
  const { fontSize, readOnly, required } = fieldMeta;

  if (fontSize && (fontSize < 8 || fontSize > 96)) {
    errors.push('Font size must be between 8 and 96.');
  }

  if (readOnly && required) {
    errors.push('A field cannot be both read-only and required');
  }

  return errors;
};
