import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import type { RecipientRole } from '@documenso/prisma/client';

import { Body, Container, Head, Html, Img, Preview, Section } from '../components';
import { useBranding } from '../providers/branding';
import type { TemplateDocumentInviteProps } from '../template-components/template-document-invite';
import { TemplateDocumentInvite } from '../template-components/template-document-invite';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentInviteEmailTemplateProps = Partial<TemplateDocumentInviteProps> & {
  customBody?: string;
  role: RecipientRole;
  selfSigner?: boolean;
  isTeamInvite?: boolean;
  teamName?: string;
  teamEmail?: string;
  includeSenderDetails?: boolean;
};

export const DocumentInviteEmailTemplate = ({
  inviterName = 'Lucas Smith',
  inviterEmail = 'lucas@documenso.com',
  documentName = 'Open Source Pledge.pdf',
  signDocumentLink = 'https://documenso.com',
  assetBaseUrl = 'http://localhost:3002',
  customBody,
  role,
  selfSigner = false,
  isTeamInvite = false,
  teamName,
  includeSenderDetails,
}: DocumentInviteEmailTemplateProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const action = _(RECIPIENT_ROLES_DESCRIPTION[role].actionVerb).toLowerCase();

  let previewText = msg`${inviterName} has invited you to ${action} ${documentName}`;

  if (isTeamInvite) {
    previewText = includeSenderDetails
      ? msg`${inviterName} on behalf of "${teamName}" has invited you to ${action} ${documentName}`
      : msg`${teamName} has invited you to ${action} ${documentName}`;
  }

  if (selfSigner) {
    previewText = msg`Please ${action} your document ${documentName}`;
  }

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="mx-auto my-auto flex w-11/12 flex-col items-center justify-center gap-6 rounded-lg bg-zinc-50 p-6">
        <Section>
          <Container className="mb-4 flex w-full flex-col items-center justify-center gap-2 self-stretch rounded-lg border border-zinc-50 bg-white px-6 py-4">
            <Section>
              {branding.brandingEnabled && branding.brandingLogo ? (
                <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-6" />
              ) : (
                <div className="w-11/12 items-center justify-center gap-2 rounded-md bg-[#06C] p-4">
                  <Img
                    src={getAssetUrl('/static/file-pen-line.png')}
                    alt="icon image - file pen line"
                    className="mb-4 h-8"
                  />
                  <p className="text-center text-lg font-medium text-white">
                    You are invited to sign a document
                  </p>
                </div>
              )}

              {/* {customBody} */}

              {customBody && <div dangerouslySetInnerHTML={{ __html: customBody }} />}

              <TemplateDocumentInvite
                inviterName={inviterName}
                inviterEmail={inviterEmail}
                documentName={documentName}
                signDocumentLink={signDocumentLink}
                assetBaseUrl={assetBaseUrl}
                role={role}
                selfSigner={selfSigner}
                isTeamInvite={isTeamInvite}
                teamName={teamName}
                includeSenderDetails={includeSenderDetails}
              />
            </Section>
          </Container>

          {/* <Container className="mx-auto mt-12 max-w-xl">
            <Section>
              {!isTeamInvite && (
                <Text className="my-4 text-base font-semibold">
                  <Trans>
                    {inviterName}{' '}
                    <Link className="font-normal text-slate-400" href="mailto:{inviterEmail}">
                      ({inviterEmail})
                    </Link>
                  </Trans>
                </Text>
              )}

              <Text className="mt-2 text-base text-slate-400">
                {customBody ? (
                  <pre className="font-sans text-base text-slate-400">{customBody}</pre>
                ) : (
                  <Trans>
                    {inviterName} has invited you to {action} the document "{documentName}".
                  </Trans>
                )}
              </Text>
            </Section>
          </Container> */}

          <Container className="flex w-full flex-col items-center justify-center gap-2 self-stretch rounded-lg border border-zinc-50 bg-white px-6 py-4">
            <TemplateFooter />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

export default DocumentInviteEmailTemplate;
