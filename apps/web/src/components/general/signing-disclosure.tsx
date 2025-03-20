import type { HTMLAttributes } from 'react';

import { Trans } from '@lingui/macro';

import { cn } from '@documenso/ui/lib/utils';

export type SigningDisclosureProps = HTMLAttributes<HTMLParagraphElement>;

export const SigningDisclosure = ({ className, ...props }: SigningDisclosureProps) => {
  return (
    <p className={cn('text-xs font-normal leading-4 text-zinc-600', className)} {...props}>
      <Trans>
        By clicking the <strong>"I ACCEPT"</strong> button, you agree to review the documents and
        provide your electronic signature. You acknowledge that your electronic signature will have
        the same legal validity and effect as a handwritten signature, ensuring the document is
        complete and legally binding.{' '}
      </Trans>
    </p>
  );
};
