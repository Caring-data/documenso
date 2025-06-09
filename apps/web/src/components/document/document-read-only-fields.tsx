'use client';

import { useState } from 'react';

import { Trans } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Clock } from 'lucide-react';
import { P, match } from 'ts-pattern';

import {
  DEFAULT_DOCUMENT_DATE_FORMAT,
  convertToLocalSystemFormat,
} from '@documenso/lib/constants/date-formats';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import type { DocumentField } from '@documenso/lib/server-only/field/get-fields-for-document';
import { ZRadioFieldMeta } from '@documenso/lib/types/field-meta';
import { fromCheckboxValue } from '@documenso/lib/universal/field-checkbox';
import { parseMessageDescriptor } from '@documenso/lib/utils/i18n';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import type { DocumentMeta } from '@documenso/prisma/client';
import { FieldType, SigningStatus } from '@documenso/prisma/client';
import { FieldRootContainer } from '@documenso/ui/components/field/field';
import { SignatureIcon } from '@documenso/ui/icons/signature';
import { cn } from '@documenso/ui/lib/utils';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';
import { Badge } from '@documenso/ui/primitives/badge';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { Label } from '@documenso/ui/primitives/label';
import { PopoverHover } from '@documenso/ui/primitives/popover';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';

export type DocumentReadOnlyFieldsProps = {
  fields: DocumentField[];
  documentMeta?: DocumentMeta;
  showFieldStatus?: boolean;
};

export const DocumentReadOnlyFields = ({
  documentMeta,
  fields,
  showFieldStatus = true,
}: DocumentReadOnlyFieldsProps) => {
  const { _ } = useLingui();

  const [hiddenFieldIds, setHiddenFieldIds] = useState<Record<string, boolean>>({});

  const handleHideField = (fieldId: string) => {
    setHiddenFieldIds((prev) => ({ ...prev, [fieldId]: true }));
  };

  return (
    <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
      {fields.map(
        (field) =>
          !hiddenFieldIds[field.secondaryId] && (
            <FieldRootContainer
              field={field}
              key={field.id}
              cardClassName="border-gray-300/50 !shadow-none backdrop-blur-[1px] bg-gray-50 ring-0 ring-offset-0"
            >
              <div className="absolute -right-3 -top-3">
                <PopoverHover
                  trigger={
                    <Avatar className="dark:border-foreground h-8 w-8 border-2 border-solid border-gray-200/50 transition-colors hover:border-gray-200">
                      <AvatarFallback className="bg-neutral-50 text-xs text-gray-400">
                        {extractInitials(field.recipient.name || (field.recipient.email ?? ''))}
                      </AvatarFallback>
                    </Avatar>
                  }
                  contentProps={{
                    className: 'relative flex w-fit flex-col p-4 text-sm',
                  }}
                >
                  {showFieldStatus && (
                    <Badge
                      className="mx-auto mb-1 py-0.5"
                      variant={
                        field.recipient.signingStatus === SigningStatus.SIGNED
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {field.recipient.signingStatus === SigningStatus.SIGNED ? (
                        <>
                          <SignatureIcon className="mr-1 h-3 w-3" />
                          <Trans>Signed</Trans>
                        </>
                      ) : (
                        <>
                          <Clock className="mr-1 h-3 w-3" />
                          <Trans>Pending</Trans>
                        </>
                      )}
                    </Badge>
                  )}

                  <p className="text-center font-semibold">
                    <span>{parseMessageDescriptor(_, FRIENDLY_FIELD_TYPE[field.type])} field</span>
                  </p>

                  <p className="text-muted-foreground mt-1 text-center text-xs">
                    {field.recipient.name
                      ? `${field.recipient.name} (${field.recipient.email})`
                      : field.recipient.email}{' '}
                  </p>
                </PopoverHover>
              </div>

              <div className="text-muted-foreground dark:text-background/70 break-all text-[10px] sm:text-sm">
                {field.recipient.signingStatus === SigningStatus.SIGNED &&
                  match(field)
                    .with({ type: FieldType.SIGNATURE }, (field) =>
                      field.signature?.signatureImageAsBase64 ? (
                        <div className="flex h-full w-full items-center justify-center">
                          <img
                            src={field.signature.signatureImageAsBase64}
                            alt="Signature"
                            className="h-auto max-h-[65%] w-auto max-w-[65%] object-contain dark:invert"
                          />
                        </div>
                      ) : (
                        <p className="font-signature text-muted-foreground sm:text-md text-sm duration-200 md:text-2xl">
                          {field.signature?.typedSignature}
                        </p>
                      ),
                    )
                    .with(
                      {
                        type: P.union(
                          FieldType.NAME,
                          FieldType.INITIALS,
                          FieldType.EMAIL,
                          FieldType.NUMBER,
                          FieldType.DROPDOWN,
                        ),
                      },
                      () => field.customText,
                    )
                    .with({ type: FieldType.CHECKBOX }, (field) => {
                      const parsedValues = fromCheckboxValue(field.customText ?? '[]');

                      return (
                        <div className="flex flex-col gap-1 p-1">
                          {parsedValues.length === 0 ? (
                            <div className="flex items-center gap-x-1">
                              <input type="checkbox" checked={false} disabled className="h-3 w-3" />
                              <span className="text-muted-foreground text-xs italic">
                                Sin selección
                              </span>
                            </div>
                          ) : (
                            parsedValues.map((value, idx) => (
                              <div key={idx} className="flex items-center gap-x-1">
                                <Checkbox checked disabled className="h-3 w-3" />
                                <span className="text-muted-foreground text-xs">
                                  {value.startsWith('empty-value-') ? '' : value}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })
                    .with({ type: FieldType.RADIO }, (field) => {
                      const parsedFieldMeta = ZRadioFieldMeta.safeParse(field.fieldMeta);
                      if (!parsedFieldMeta.success) return null;

                      const values = parsedFieldMeta.data.values?.map((item) => ({
                        ...item,
                        value: item.value.length > 0 ? item.value : `empty-value-${item.id}`,
                      }));

                      if (!values || values.length === 0) return null;

                      return (
                        <RadioGroup className="gap-y-1 space-y-4 p-1">
                          {values.map((item, index) => {
                            const isChecked = item.value === field.customText;

                            return (
                              <div key={index} className="flex items-center gap-x-1.5">
                                <RadioGroupItem
                                  className="h-[11.5px] w-[11.5px]"
                                  value={item.value}
                                  id={`readonly-radio-${field.id}-${index}`}
                                  checked={isChecked}
                                  disabled
                                />
                                <Label
                                  htmlFor={`readonly-radio-${field.id}-${index}`}
                                  className="text-xs"
                                >
                                  {item.value.includes('empty-value-') ? '' : item.value}
                                </Label>
                              </div>
                            );
                          })}
                        </RadioGroup>
                      );
                    })
                    .with({ type: FieldType.TEXT }, () => field.customText.substring(0, 20) + '...')
                    .with({ type: FieldType.DATE }, () =>
                      convertToLocalSystemFormat(
                        field.customText,
                        documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
                        documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
                      ),
                    )
                    .with({ type: FieldType.CALENDAR }, () =>
                      convertToLocalSystemFormat(
                        field.customText,
                        documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
                        documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
                      ),
                    )
                    .with({ type: FieldType.FREE_SIGNATURE }, () => null)
                    .exhaustive()}

                {field.recipient.signingStatus === SigningStatus.NOT_SIGNED && (
                  <p
                    className={cn(
                      'text-muted-foreground text-center text-[10px] leading-tight duration-200',
                      'overflow-hidden truncate whitespace-nowrap px-1',
                      {
                        'font-signature md:text-md sm:text-sm':
                          field.type === FieldType.SIGNATURE ||
                          field.type === FieldType.FREE_SIGNATURE,
                      },
                    )}
                  >
                    {parseMessageDescriptor(_, FRIENDLY_FIELD_TYPE[field.type])}
                  </p>
                )}
              </div>
            </FieldRootContainer>
          ),
      )}
    </ElementVisible>
  );
};
