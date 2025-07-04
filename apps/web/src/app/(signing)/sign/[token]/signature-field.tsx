'use client';

import { useMemo, useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SigningDisclosure } from '~/components/general/signing-disclosure';
import { isTypedSignatureSettings } from '~/helpers/signature';

import { useRequiredDocumentAuthContext } from './document-auth-provider';
import { useRequiredSigningContext } from './provider';
import { useRecipientContext } from './recipient-context';
import type { SignaturePadValue } from './signature-pad';
import { SignaturePad } from './signature-pad';
import { SigningFieldContainer } from './signing-field-container';

type SignatureFieldState = 'empty' | 'signed-image' | 'signed-text';
export type SignatureFieldProps = {
  field: FieldWithSignature;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
  typedSignatureEnabled?: boolean;
};

export const SignatureField = ({
  field,
  onSignField,
  onUnsignField,
  typedSignatureEnabled,
}: SignatureFieldProps) => {
  const router = useRouter();
  const { _ } = useLingui();
  const { toast } = useToast();
  const { recipient } = useRecipientContext();

  const signatureRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    signature: providedSignature,
    setSignature: setProvidedSignature,
    signatureValid,
    setSignatureValid,
  } = useRequiredSigningContext();

  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isPending: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const { signature } = field;

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [localSignature, setLocalSignature] = useState<SignaturePadValue | null>(providedSignature);

  const state = useMemo<SignatureFieldState>(() => {
    if (!field.inserted) {
      return 'empty';
    }

    if (signature?.signatureImageAsBase64) {
      return 'signed-image';
    }

    return 'signed-text';
  }, [field.inserted, signature?.signatureImageAsBase64]);

  const onPreSign = () => {
    if (!providedSignature || !signatureValid) {
      setShowSignatureModal(true);
      return false;
    }

    return true;
  };
  /**
   * When the user clicks the sign button in the dialog where they enter their signature.
   */
  const onDialogSignClick = () => {
    if (!localSignature?.value) return;
    setProvidedSignature(localSignature);
    setSignatureValid(true);
    setShowSignatureModal(false);

    void executeActionAuthProcedure({
      onReauthFormSubmit: async (authOptions) => await onSign(authOptions, localSignature),
      actionTarget: field.type,
    });
  };

  const onSign = async (
    authOptions?: TRecipientActionAuth,
    signature?: string | SignaturePadValue,
  ) => {
    try {
      const rawSignature = signature || providedSignature;
      const value = typeof rawSignature === 'string' ? rawSignature : (rawSignature?.value ?? '');

      if (!value || (signature && !signatureValid)) {
        setShowSignatureModal(true);
        return;
      }

      const isTypedSignature = !value.startsWith('data:image');

      if (isTypedSignature && !typedSignatureEnabled) {
        toast({
          title: _(msg`Error`),
          description: _(msg`Typed signatures are not allowed. Please draw your signature.`),
          variant: 'destructive',
        });

        return;
      }

      const typedSignatureSettings =
        typeof rawSignature === 'object' && isTypedSignature
          ? {
              font: rawSignature?.font,
              color: rawSignature?.color,
            }
          : undefined;

      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value,
        isBase64: !isTypedSignature,
        authOptions,
        typedSignatureSettings,
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
        description: _(msg`An error occurred while signing the document.`),
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
        description: _(msg`An error occurred while removing the signature.`),
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
      type="Signature"
    >
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {state === 'empty' && (
        <p
          className={cn(
            'group-hover:text-primary font-signature text-muted-foreground flex items-center justify-center text-[0.5rem] duration-200 sm:text-xl',
            {
              'group-hover:text-yellow-300': !isRequired,
              'group-hover:text-red-300': isRequired,
            },
          )}
        >
          <Trans>Signature</Trans>
        </p>
      )}

      {state === 'signed-image' && signature?.signatureImageAsBase64 && (
        <div className="-mt-1 flex h-full w-full items-center justify-center">
          <img
            src={signature.signatureImageAsBase64}
            alt={`Signature for ${recipient.name}`}
            className="h-6 w-auto object-contain sm:h-12"
          />
        </div>
      )}

      {state === 'signed-text' && isTypedSignatureSettings(signature?.typedSignatureSettings) && (
        <div ref={containerRef} className="flex h-full w-full items-center justify-center p-2">
          <p
            ref={signatureRef}
            className="w-full overflow-hidden break-all text-center text-sm leading-tight duration-200 sm:text-2xl"
            style={{
              color: signature?.typedSignatureSettings?.color || 'black',
              fontFamily: signature?.typedSignatureSettings?.font || 'Dancing Script',
            }}
          >
            {signature?.typedSignature}
          </p>
        </div>
      )}

      <Dialog open={showSignatureModal} onOpenChange={setShowSignatureModal}>
        <DialogContent hideClose={false} className="p-6 pt-4" position="center">
          <DialogTitle>
            <Trans>
              Sign as {recipient.name}{' '}
              <div className="text-muted-foreground mb-2 h-5">({recipient.email})</div>
            </Trans>
          </DialogTitle>
          <SignaturePad
            id="signature"
            value={localSignature ?? undefined}
            onChange={(sig) => {
              setLocalSignature(sig);
              setSignatureValid(Boolean(sig.value));
            }}
            typedSignatureEnabled={typedSignatureEnabled}
            uploadSignatureEnabled={true}
            drawSignatureEnabled={true}
          />
          <SigningDisclosure />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                <Trans>Cancel</Trans>
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={!localSignature || !signatureValid}
              onClick={() => onDialogSignClick()}
            >
              <Trans>Sign</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SigningFieldContainer>
  );
};
