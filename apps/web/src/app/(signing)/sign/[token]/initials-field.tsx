'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredSigningContext } from './provider';
import { useRecipientContext } from './recipient-context';
import { SigningFieldContainer } from './signing-field-container';

type ValidationErrors = {
  required: string[];
};

export type InitialsFieldProps = {
  field: FieldWithSignature;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const InitialsField = ({ field, onSignField, onUnsignField }: InitialsFieldProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const { _ } = useLingui();

  const initialErrors: ValidationErrors = {
    required: [],
  };
  const [errors, setErrors] = useState(initialErrors);
  const userInputHasErrors = Object.values(errors).some((error) => error.length > 0);

  const { fullName } = useRequiredSigningContext();
  const { recipient, targetSigner, isAssistantMode } = useRecipientContext();
  const initials = extractInitials(fullName);

  // Check if initials are available and update errors accordingly
  const validateInitials = () => {
    const newErrors = { ...initialErrors };

    if (!initials || initials.trim() === '') {
      newErrors.required.push(
        _(msg`Initials are required. Please ensure your name is properly set.`),
      );
    }

    setErrors(newErrors);
    return newErrors.required.length === 0;
  };

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isPending: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const onPreSign = () => {
    return validateInitials();
  };

  const onSign = async (authOptions?: TRecipientActionAuth) => {
    try {
      if (!validateInitials()) {
        toast({
          title: _(msg`Validation Error`),
          description: _(msg`Please ensure your name is properly set to extract initials.`),
          variant: 'destructive',
        });
        return;
      }

      const value = initials ?? '';

      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value,
        isBase64: false,
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

  const isRequired = field?.fieldMeta?.required === true;

  return (
    <SigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onRemove}
      type="Initials"
    >
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <p
          className={cn(
            'group-hover:text-primary text-muted-foreground text-[clamp(0.425rem,25cqw,0.825rem)] duration-200',
            {
              'group-hover:text-yellow-300': !isRequired,
              'group-hover:text-red-300': isRequired,
            },
          )}
        >
          <Trans>Initials</Trans>
          {userInputHasErrors && <span className="ml-1 text-red-500">*</span>}
        </p>
      )}

      {field.inserted && (
        <p className="text-muted-foreground dark:text-background/80 text-[clamp(0.425rem,25cqw,0.825rem)] duration-200">
          {field.customText}
        </p>
      )}

      {userInputHasErrors && !field.inserted && (
        <div className="absolute -bottom-4 left-0 right-0 text-center">
          <span className="rounded bg-white/80 px-1 text-xs text-red-500">
            {errors.required[0]}
          </span>
        </div>
      )}
    </SigningFieldContainer>
  );
};
