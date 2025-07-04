import { notFound } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { CheckCircle2, Clock8 } from 'lucide-react';
import { env } from 'next-runtime-env';

import signingCelebration from '@documenso/assets/images/signing-celebration.png';
import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { isRecipientAuthorized } from '@documenso/lib/server-only/document/is-recipient-authorized';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { getRecipientSignatures } from '@documenso/lib/server-only/recipient/get-recipient-signatures';
import { getUserByEmail } from '@documenso/lib/server-only/user/get-user-by-email';
import { DocumentStatus, FieldType, RecipientRole } from '@documenso/prisma/client';
import { DocumentDownloadButton } from '@documenso/ui/components/document/document-download-button';
import { SigningCard3D } from '@documenso/ui/components/signing-card';
import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';

import { SigningAuthPageView } from '../signing-auth-page';
import { DocumentPreviewButton } from './document-preview-button';
import { PollUntilDocumentCompleted } from './poll-until-document-completed';

export type CompletedSigningPageProps = {
  params: {
    token?: string;
  };
};

export default async function CompletedSigningPage({
  params: { token },
}: CompletedSigningPageProps) {
  await setupI18nSSR();

  const { _ } = useLingui();

  const NEXT_PUBLIC_DISABLE_SIGNUP = env('NEXT_PUBLIC_DISABLE_SIGNUP');

  if (!token) {
    return notFound();
  }

  const { user } = await getServerComponentSession();

  const document = await getDocumentAndSenderByToken({
    token,
    requireAccessAuth: false,
  }).catch(() => null);

  if (!document || !document.documentData) {
    return notFound();
  }

  const { documentData } = document;

  const [fields, recipient] = await Promise.all([
    getFieldsForToken({ token }),
    getRecipientByToken({ token }).catch(() => null),
  ]);

  if (!recipient) {
    return notFound();
  }

  const isDocumentAccessValid = await isRecipientAuthorized({
    type: 'ACCESS',
    documentAuthOptions: document.authOptions,
    recipient,
    userId: user?.id,
  });

  if (!isDocumentAccessValid) {
    return <SigningAuthPageView email={recipient.email ?? ''} />;
  }

  const signatures = await getRecipientSignatures({ recipientId: recipient.id });
  const isExistingUser = await getUserByEmail({ email: recipient.email ?? '' })
    .then((u) => !!u)
    .catch(() => false);

  const recipientName =
    recipient.name ??
    fields.find((field) => field.type === FieldType.NAME)?.customText ??
    recipient.email ??
    'Unnamed';

  const canSignUp = !isExistingUser && NEXT_PUBLIC_DISABLE_SIGNUP !== 'true';

  return (
    <div
      className={cn(
        'flex flex-col items-center overflow-x-hidden px-4 pt-24 md:px-8 lg:pt-36 xl:pt-44',
        { 'pt-0 lg:pt-0 xl:pt-0': canSignUp },
      )}
    >
      <div
        className={cn('relative mt-6 flex w-full flex-col items-center justify-center', {
          'mt-0 flex-col divide-y overflow-hidden pt-6 md:pt-16 lg:flex-row lg:divide-x lg:divide-y-0 lg:pt-20 xl:pt-24':
            canSignUp,
        })}
      >
        <div
          className={cn('flex flex-col items-center', {
            'mb-8 p-4 md:mb-0 md:p-12': canSignUp,
          })}
        >
          <Badge variant="neutral" size="default" className="mb-6 rounded-xl border bg-transparent">
            <span className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]">
              {document.documentDetails?.documentName}
            </span>
          </Badge>

          {/* Card with recipient */}
          <SigningCard3D
            name={recipientName}
            signature={signatures.at(0)}
            signingCelebrationImage={signingCelebration}
          />

          <h2 className="mt-6 max-w-[35ch] text-center text-2xl font-semibold leading-normal md:text-3xl lg:text-3xl">
            {recipient.role === RecipientRole.SIGNER && <Trans>Document Successfully Signed</Trans>}
            {recipient.role === RecipientRole.VIEWER && <Trans>Document Viewed</Trans>}
            {recipient.role === RecipientRole.APPROVER && <Trans>Document Approved</Trans>}
          </h2>

          {(() => {
            const allSigned = document.recipients?.every((r) => r.signingStatus === 'SIGNED');

            const emailSettings = document.documentMeta?.emailSettings;
            const isSingleRecipient = emailSettings?.documentPending === false;

            const hasRecipientWithOrder2or3 = document.recipients?.some(
              (r) => r.signingOrder === 2 || r.signingOrder === 3,
            );

            if (document.status === DocumentStatus.COMPLETED) {
              return (
                <div className="text-documenso-700 mt-4 flex items-center text-center">
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  <span className="text-sm">
                    <Trans>All parties have signed the document.</Trans>
                  </span>
                </div>
              );
            }

            if (
              document.deletedAt === null &&
              document.status === DocumentStatus.PENDING &&
              allSigned &&
              (isSingleRecipient || hasRecipientWithOrder2or3)
            ) {
              return (
                <div className="mt-4 flex items-center text-center text-blue-600">
                  <Clock8 className="mr-2 h-5 w-5" />
                  <span className="text-sm">
                    <Trans>Document is preparing...</Trans>
                  </span>
                </div>
              );
            }

            if (document.deletedAt === null) {
              return (
                <div className="mt-4 flex items-center text-center text-blue-600">
                  <Clock8 className="mr-2 h-5 w-5" />
                  <span className="text-sm">
                    <Trans>Waiting for others to sign</Trans>
                  </span>
                </div>
              );
            }

            return (
              <div className="flex items-center text-center text-red-600">
                <Clock8 className="mr-2 h-5 w-5" />
                <span className="text-sm">
                  <Trans>Document no longer available to sign</Trans>
                </span>
              </div>
            );
          })()}

          {(() => {
            const allSigned = document.recipients?.every((r) => r.signingStatus === 'SIGNED');

            const emailSettings = document.documentMeta?.emailSettings;
            const isSingleRecipient = emailSettings?.documentPending === false;

            const hasRecipientWithOrder2or3 = document.recipients?.some(
              (r) => r.signingOrder === 2 || r.signingOrder === 3,
            );

            if (document.status === DocumentStatus.COMPLETED) {
              return (
                <p className="text-muted-foreground/60 mt-2.5 max-w-[60ch] text-center text-sm font-medium md:text-base">
                  <Trans>
                    A copy of the completed document will be sent to your email shortly. You may
                    also download it below.
                  </Trans>
                </p>
              );
            }

            if (
              document.deletedAt === null &&
              document.status === DocumentStatus.PENDING &&
              isSingleRecipient &&
              allSigned &&
              (isSingleRecipient || hasRecipientWithOrder2or3)
            ) {
              return (
                <p className="text-muted-foreground/60 mt-2.5 max-w-[60ch] text-center text-sm font-medium md:text-base">
                  <Trans>
                    The document is being prepared. You'll receive a copy once it's ready.
                  </Trans>
                </p>
              );
            }

            if (document.deletedAt === null) {
              return (
                <p className="text-muted-foreground/60 mt-2.5 max-w-[60ch] text-center text-sm font-medium md:text-base">
                  <Trans>
                    You will receive an Email copy of the signed document once everyone has signed.
                  </Trans>
                </p>
              );
            }

            return (
              <p className="text-muted-foreground/60 mt-2.5 max-w-[60ch] text-center text-sm font-medium md:text-base">
                <Trans>
                  This document has been cancelled by the owner and is no longer available for
                  others to sign.
                </Trans>
              </p>
            );
          })()}

          <div className="mt-8 flex w-full max-w-sm items-center justify-center gap-4">
            {document.status === DocumentStatus.COMPLETED ? (
              <DocumentDownloadButton
                className="flex-1"
                fileName={document.title}
                documentData={documentData}
                disabled={document.status !== DocumentStatus.COMPLETED}
              />
            ) : (
              <DocumentPreviewButton
                className="text-[11px]"
                title={_(msg`Signatures will appear once the document has been completed`)}
                documentData={documentData}
              />
            )}
          </div>
        </div>
      </div>

      <PollUntilDocumentCompleted document={document} />
    </div>
  );
}
