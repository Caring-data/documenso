import { Trans } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { match } from 'ts-pattern';

import { RecipientRole } from '@documenso/prisma/client';

import { Button, Section, Text } from '../components';

export interface TemplateDocumentInviteProps {
  inviterName: string;
  inviterEmail: string;
  documentName: string;
  signDocumentLink: string;
  assetBaseUrl: string;
  role: RecipientRole;
  selfSigner: boolean;
  isTeamInvite: boolean;
  teamName?: string;
  includeSenderDetails?: boolean;
  recipientName?: string;
  documentDetails?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    residentName?: string;
  };
  tokenExpiration?: string;
}

export const TemplateDocumentInvite = ({
  signDocumentLink,
  assetBaseUrl,
  role,
  recipientName,
  documentDetails,
  tokenExpiration,
}: TemplateDocumentInviteProps) => {
  const { _ } = useLingui();

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <>
      <Section className="flex flex-col gap-6">
        {match(role)
          .with(RecipientRole.SIGNER, () => (
            <>
              <Text className="self-stretch text-sm font-medium leading-5 text-zinc-600">
                <Trans>Dear </Trans> {recipientName},
              </Text>
              <Text className="text-sm font-medium leading-5 text-zinc-600">
                <Trans>
                  <span className="font-semibold">{documentDetails?.facilityAdministrator}</span>{' '}
                  from <span className="font-semibold">{documentDetails?.companyName}</span> has
                  requested your electronic signature on the following document:
                </Trans>
              </Text>
              <div className="flex items-center gap-6">
                <img
                  src={getAssetUrl('/static/file-text.png')}
                  alt="Document Icon"
                  className="h-6 w-6"
                />
                <div className="flex flex-col text-sm font-medium leading-5 text-zinc-600">
                  <Text>
                    <Trans>{documentDetails?.documentName}</Trans>
                  </Text>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <img
                  src={getAssetUrl('/static/user-round.png')}
                  alt="Document Icon"
                  className="h-6 w-6"
                />
                <div className="flex flex-col text-sm font-medium leading-5 text-zinc-600">
                  <Text>
                    <Trans>In regards to: {documentDetails?.residentName}</Trans>
                  </Text>
                </div>
              </div>
              <Text className="text-xs font-medium leading-5 text-zinc-600">
                <Trans>
                  Ready to get started?
                  <br />
                  Click the button and log into your Caring Data account to accept the invite and
                  sign the document.
                </Trans>
              </Text>
            </>
          ))
          .otherwise(() => null)}
      </Section>

      <Text className="my-1 text-center text-base text-slate-400">
        {match(role)
          .with(RecipientRole.SIGNER, () => <span></span>)
          .with(RecipientRole.VIEWER, () => <Trans>Continue by viewing the document.</Trans>)
          .with(RecipientRole.APPROVER, () => <Trans>Continue by approving the document.</Trans>)
          .with(RecipientRole.CC, () => '')
          .with(RecipientRole.ASSISTANT, () => (
            <Trans>Continue by assisting with the document.</Trans>
          ))
          .exhaustive()}
      </Text>

      <Section className="mt-6 text-center">
        <Button
          className="bg-brand inline-flex items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-medium text-white no-underline"
          href={signDocumentLink}
        >
          {match(role)
            .with(RecipientRole.SIGNER, () => <Trans>Accept Invite and Sign</Trans>)
            .with(RecipientRole.VIEWER, () => <Trans>View Document</Trans>)
            .with(RecipientRole.APPROVER, () => <Trans>Approve Document</Trans>)
            .with(RecipientRole.CC, () => '')
            .with(RecipientRole.ASSISTANT, () => <Trans>Assist Document</Trans>)
            .exhaustive()}
        </Button>
      </Section>
      <Text className="text-center text-xs font-medium leading-4 text-[#DC2626]">
        <Trans>
          This link is valid until{' '}
          {tokenExpiration ? new Date(tokenExpiration).toLocaleDateString('en-US') : 'N/A'}
        </Trans>
      </Text>
    </>
  );
};

export default TemplateDocumentInvite;
