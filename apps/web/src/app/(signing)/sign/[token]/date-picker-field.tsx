'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { CalendarIcon, Loader } from 'lucide-react';
import { DateTime } from 'luxon';

import {
  DEFAULT_DOCUMENT_DATE_FORMAT,
  convertToLocalSystemFormat,
} from '@documenso/lib/constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZDateFieldMeta } from '@documenso/lib/types/field-meta';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { Calendar } from '@documenso/ui/primitives/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRecipientContext } from './recipient-context';
import { SigningFieldContainer } from './signing-field-container';

type DatePickerFieldProps = {
  field: FieldWithSignature;
  dateFormat?: string;
  timezone?: string;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const DatePickerField = ({
  field,
  dateFormat = DEFAULT_DOCUMENT_DATE_FORMAT,
  timezone = DEFAULT_DOCUMENT_TIME_ZONE,
  onSignField,
  onUnsignField,
}: DatePickerFieldProps) => {
  const { _ } = useLingui();
  const router = useRouter();
  const { toast } = useToast();
  const { recipient, isAssistantMode } = useRecipientContext();
  const [isPending, startTransition] = useTransition();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { mutateAsync: signFieldWithToken, isPending: isSignLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const { mutateAsync: removeSignedFieldWithToken, isPending: isRemoveLoading } =
    trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const safeFieldMeta = ZDateFieldMeta.safeParse(field.fieldMeta);
  const parsedFieldMeta = safeFieldMeta.success ? safeFieldMeta.data : null;

  const isLoading = isSignLoading || isRemoveLoading || isPending;

  const handleSign = async (date: DateTime, authOptions?: TRecipientActionAuth) => {
    const formatted = date.toFormat(dateFormat);
    const payload: TSignFieldWithTokenMutationSchema = {
      token: recipient.token,
      fieldId: field.id,
      value: formatted,
      authOptions,
    };

    try {
      if (onSignField) {
        await onSignField(payload);
      } else {
        await signFieldWithToken(payload);
      }

      startTransition(() => router.refresh());
    } catch (err) {
      const error = AppError.parseError(err);
      if (error.code === AppErrorCode.UNAUTHORIZED) throw error;

      console.error(err);
      toast({
        title: _(msg`Error`),
        description: isAssistantMode
          ? _(msg`An error occurred while signing as assistant.`)
          : _(msg`An error occurred while signing the document.`),
        variant: 'destructive',
      });
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    const dateTime = DateTime.fromJSDate(date).setZone(timezone);
    void handleSign(dateTime);
  };

  const handleRemove = async () => {
    const payload: TRemovedSignedFieldWithTokenMutationSchema = {
      token: recipient.token,
      fieldId: field.id,
    };

    try {
      if (onUnsignField) {
        await onUnsignField(payload);
      } else {
        await removeSignedFieldWithToken(payload);
      }

      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);
      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while removing the field.`),
        variant: 'destructive',
      });
    }
  };

  const displayDate = field.inserted
    ? convertToLocalSystemFormat(field.customText, dateFormat, timezone)
    : '';
  console.log(selectedDate);
  return (
    <SigningFieldContainer field={field} onSign={() => {}} onRemove={handleRemove} type="Date">
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!field.inserted && (
        <div className="text-muted-foreground flex w-full items-center justify-center text-sm">
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span>
            <Trans>Select a date</Trans>
          </span>
        </div>
      )}

      {field.inserted && <p className="text-muted-foreground text-center text-sm">{displayDate}</p>}

      {!field.inserted && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full rounded-md border bg-white px-2 py-1 text-sm text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none"
            >
              <CalendarIcon className="mr-2 inline h-4 w-4" />
              <span className="align-middle text-gray-600">
                <Trans>Select a date</Trans>
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="z-50 p-0 shadow-md" align="start">
            <Calendar
              mode="single"
              selected={selectedDate ?? undefined}
              onSelect={(date) => {
                if (date) handleDateSelect(date);
              }}
              className="rounded-md border bg-white shadow-lg"
            />
          </PopoverContent>
        </Popover>
      )}
    </SigningFieldContainer>
  );
};
