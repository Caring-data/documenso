'use client';

import { useEffect, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';
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
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRecipientContext } from './recipient-context';
import { SigningFieldContainer } from './signing-field-container';

export type DateFieldProps = {
  field: FieldWithSignature;
  dateFormat?: string | null;
  timezone?: string | null;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const DateField = ({
  field,
  dateFormat = DEFAULT_DOCUMENT_DATE_FORMAT,
  timezone = DEFAULT_DOCUMENT_TIME_ZONE,
  onSignField,
  onUnsignField,
}: DateFieldProps) => {
  const router = useRouter();
  const { _ } = useLingui();
  const { toast } = useToast();

  const { recipient, targetSigner, isAssistantMode } = useRecipientContext();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isPending: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const safeFieldMeta = ZDateFieldMeta.safeParse(field.fieldMeta);
  const parsedFieldMeta = safeFieldMeta.success ? safeFieldMeta.data : null;

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const localDateString = convertToLocalSystemFormat(field.customText, dateFormat, timezone);
  const isDifferentTime = field.inserted && localDateString !== field.customText;
  const tooltipText = _(
    msg`"${field.customText}" will appear on the document as it has a timezone of "${timezone}".`,
  );

  const onSign = async (authOptions?: TRecipientActionAuth) => {
    try {
      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value: dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
        authOptions,
      };

      if (onSignField) {
        await onSignField(payload);
        return;
      }

      await signFieldWithToken(payload);

      startTransition(() => router.refresh());
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

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

  useEffect(() => {
    const signDefaultDate = async () => {
      if (!field.inserted) {
        const today = DateTime.now()
          .setZone(timezone ?? DEFAULT_DOCUMENT_TIME_ZONE)
          .toFormat(dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT);

        const payload: TSignFieldWithTokenMutationSchema = {
          token: recipient.token,
          fieldId: field.id,
          value: today,
          authOptions: undefined,
        };

        await signFieldWithToken(payload);
        startTransition(() => router.refresh());
      }
    };

    void signDefaultDate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRemove = async () => {
    try {
      const payload: TRemovedSignedFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
      };

      if (onUnsignField) {
        await onUnsignField(payload);
        return;
      }

      await removeSignedFieldWithToken(payload);

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

  return (
    <SigningFieldContainer
      field={field}
      onSign={onSign}
      onRemove={onRemove}
      type="Date"
      tooltipText={isDifferentTime ? tooltipText : undefined}
    >
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <p className="group-hover:text-primary text-muted-foreground text-[clamp(0.425rem,25cqw,0.825rem)] duration-200 group-hover:text-yellow-300">
          <Trans>Date</Trans>
        </p>
      )}

      {field.inserted && (
        <div className="flex h-full w-full items-center">
          <p
            className={cn(
              'text-muted-foreground dark:text-background/80 flex w-full items-center justify-center text-[0.5rem] duration-200 sm:text-xs md:text-sm',
              {
                'text-left': parsedFieldMeta?.textAlign === 'left',
                'text-center':
                  !parsedFieldMeta?.textAlign || parsedFieldMeta?.textAlign === 'center',
                'text-right': parsedFieldMeta?.textAlign === 'right',
              },
            )}
          >
            {localDateString}
          </p>
        </div>
      )}
    </SigningFieldContainer>
  );
};
