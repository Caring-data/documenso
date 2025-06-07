import type { HTMLAttributes } from 'react';
import { useState } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { Trans } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { motion } from 'framer-motion';

import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { parseMessageDescriptor } from '@documenso/lib/utils/i18n';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

import { SigningDisclosure } from '~/components/general/signing-disclosure';

import { useRecipientContext } from '../recipient-context';
import type { SignaturePadValue } from './signature-pad';
import { SignaturePad } from './signature-pad';
import { SignatureRender } from './signature-render';

export type SignaturePadDialogProps = Omit<HTMLAttributes<HTMLCanvasElement>, 'onChange'> & {
  disabled?: boolean;
  value?: SignaturePadValue;
  onChange: (value: SignaturePadValue) => void;
  dialogConfirmText?: MessageDescriptor | string;
  disableAnimation?: boolean;
  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
};

export const SignaturePadDialog = ({
  className,
  value,
  onChange,
  disabled = false,
  disableAnimation = false,
  typedSignatureEnabled,
  uploadSignatureEnabled,
  drawSignatureEnabled,
  dialogConfirmText,
}: SignaturePadDialogProps) => {
  const { i18n } = useLingui();
  const { recipient } = useRecipientContext();

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [tempSignature, setTempSignature] = useState<SignaturePadValue>({
    type: value?.type ?? DocumentSignatureType.TYPE,
    value: value?.value ?? '',
    font: value?.font ?? 'Dancing Script',
    color: value?.color ?? 'black',
  });

  return (
    <div
      className={cn(
        'aspect-signature-pad bg-background relative block w-full select-none rounded-lg border',
        'mt-2 flex min-h-[150px] lg:min-h-[150px]',
        className,
        {
          'pointer-events-none opacity-50': disabled,
        },
      )}
    >
      {value && (
        <div className="relative min-h-[130px] w-full md:min-h-[130px]">
          <SignatureRender
            className="h-full w-full"
            value={value.value}
            font={value.font}
            color={value.color}
          />
        </div>
      )}
      <motion.button
        data-testid="signature-pad-dialog-button"
        type="button"
        disabled={disabled}
        className="absolute inset-0 flex items-center justify-center bg-transparent"
        onClick={() => {
          setTempSignature({
            type: value?.type ?? DocumentSignatureType.TYPE,
            value: value?.value ?? '',
            font: value?.font ?? 'Dancing Script',
            color: value?.color ?? 'black',
          });
          setShowSignatureModal(true);
        }}
        whileHover="onHover"
      >
        {!value && !disableAnimation && (
          <motion.svg
            width="100"
            height="100"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-muted-foreground/60"
            variants={{
              onHover: {
                scale: 1.1,
                transition: {
                  type: 'spring',
                  stiffness: 300,
                  damping: 12,
                  mass: 0.8,
                  restDelta: 0.001,
                },
              },
            }}
          >
            <motion.path
              d="M1.5 11H14.5M1.5 14C1.5 14 8.72 2 4.86938 2H4.875C2.01 2 1.97437 14.0694 8 6.51188V6.5C8 6.5 9 11.3631 11.5 7.52375V7.5C11.5 7.5 11.5 9 14.5 9"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: 1,
                transition: {
                  pathLength: {
                    duration: 2,
                    ease: 'easeInOut',
                  },
                  opacity: { duration: 0.6 },
                },
              }}
            />
          </motion.svg>
        )}
      </motion.button>
      <Dialog open={showSignatureModal} onOpenChange={disabled ? undefined : setShowSignatureModal}>
        <DialogContent hideClose={false} className="p-6 pt-4" position="center">
          <DialogTitle>
            <Trans>
              Sign as {recipient.name}{' '}
              <div className="text-muted-foreground mb-2 h-5">({recipient.email})</div>
            </Trans>
          </DialogTitle>
          <SignaturePad
            id="signature"
            value={tempSignature}
            className={className}
            disabled={disabled}
            onChange={(sig) => setTempSignature(sig)}
            typedSignatureEnabled={typedSignatureEnabled}
            uploadSignatureEnabled={uploadSignatureEnabled}
            drawSignatureEnabled={drawSignatureEnabled}
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
              disabled={!tempSignature}
              onClick={() => {
                onChange(tempSignature);
                setShowSignatureModal(false);
              }}
            >
              {dialogConfirmText ? (
                parseMessageDescriptor(i18n._, dialogConfirmText)
              ) : (
                <Trans>Sign</Trans>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
