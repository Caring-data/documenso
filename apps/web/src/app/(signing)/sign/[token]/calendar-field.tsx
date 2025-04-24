'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { CalendarDays, Loader } from 'lucide-react';
import { DateTime } from 'luxon';

import {
  DEFAULT_DOCUMENT_DATE_FORMAT,
  convertToLocalSystemFormat,
} from '@documenso/lib/constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZCalendarFieldMeta } from '@documenso/lib/types/field-meta';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Calendar } from '@documenso/ui/primitives/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRecipientContext } from './recipient-context';
import { SigningFieldContainer } from './signing-field-container';

type ValidationErrors = {
  required: string[];
};

type CalendarFieldProps = {
  field: FieldWithSignature;
  dateFormat?: string;
  timezone?: string;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const CalendarField = ({
  field,
  dateFormat = DEFAULT_DOCUMENT_DATE_FORMAT,
  timezone = DEFAULT_DOCUMENT_TIME_ZONE,
  onSignField,
  onUnsignField,
}: CalendarFieldProps) => {
  const { _ } = useLingui();
  const router = useRouter();
  const { toast } = useToast();
  const { recipient, isAssistantMode } = useRecipientContext();
  const [isPending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const initialErrors: ValidationErrors = {
    required: [],
  };
  const [errors, setErrors] = useState(initialErrors);
  const userInputHasErrors = Object.values(errors).some((error) => error.length > 0);

  const { mutateAsync: signFieldWithToken, isPending: isSignLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);
  const { mutateAsync: removeSignedFieldWithToken, isPending: isRemoveLoading } =
    trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const safeFieldMeta = ZCalendarFieldMeta.safeParse(field.fieldMeta);
  const parsedFieldMeta = safeFieldMeta.success ? safeFieldMeta.data : null;

  const isLoading = isSignLoading || isRemoveLoading || isPending;

  const validateDate = () => {
    const newErrors = { ...initialErrors };

    setErrors(newErrors);
    return newErrors.required.length === 0;
  };

  const handleSign = async (date: DateTime, authOptions?: TRecipientActionAuth) => {
    if (!validateDate()) {
      toast({
        title: _(msg`Validation Error`),
        description: _(msg`Please select a date before signing.`),
        variant: 'destructive',
      });
      return;
    }

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
    if (parsedFieldMeta?.required && !date) {
      toast({
        title: _(msg`Missing Date`),
        description: _(msg`This field is required. Please select a date.`),
        variant: 'destructive',
      });
      return;
    }

    setSelectedDate(date);

    const dateTime = DateTime.fromJSDate(date)
      .setZone(timezone, { keepLocalTime: true })
      .set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
    console.log(selectedDate);
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

      setSelectedDate(null);

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

  return (
    <SigningFieldContainer field={field} onSign={() => {}} onRemove={handleRemove} type="Calendar">
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="h-5 w-5 animate-spin" />
        </div>
      )}

      {field.inserted && (
        <div className="flex h-full w-full items-center">
          <p
            className={cn(
              'text-muted-foreground dark:text-background/80 w-full text-[10px] duration-200 sm:text-[clamp(0.425rem,25cqw,0.825rem)]',
              {
                'text-left': parsedFieldMeta?.textAlign === 'left',
                'text-center':
                  !parsedFieldMeta?.textAlign || parsedFieldMeta?.textAlign === 'center',
                'text-right': parsedFieldMeta?.textAlign === 'right',
              },
            )}
          >
            {displayDate}
          </p>
        </div>
      )}

      {!field.inserted && (
        <Popover>
          <PopoverTrigger>
            <div
              className={cn(
                'group-hover:text-primary text-muted-foreground flex w-full cursor-pointer items-center justify-center gap-x-1 text-sm duration-200',
                {
                  'group-hover:text-yellow-300': !parsedFieldMeta?.required,
                  'group-hover:text-red-300': parsedFieldMeta?.required,
                },
              )}
            >
              <CalendarDays className="h-[clamp(0.625rem,20cqw,0.925rem)] w-[clamp(0.625rem,20cqw,0.925rem)]" />
              <span className="text-[clamp(0.425rem,25cqw,0.825rem)]">
                <Trans>Calendar</Trans>
              </span>
            </div>
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

      {userInputHasErrors && !field.inserted && (
        <div className="mt-2 text-center text-xs text-red-500">{errors.required[0]}</div>
      )}
    </SigningFieldContainer>
  );
};
