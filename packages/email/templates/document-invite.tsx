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
  recipientName?: string;
  documentDetails?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    residentName?: string;
  };
  tokenExpiration?: Date | string | undefined;
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
  recipientName,
  documentDetails,
  tokenExpiration,
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
      <Body
        className="mx-auto my-auto flex w-full flex-col items-center justify-center gap-6 rounded-lg bg-zinc-50 p-6"
        style={{ backgroundColor: '#FAFAFA' }}
      >
        <Section>
          <Container className="mb-4 flex w-full flex-col items-center justify-center gap-1 self-stretch rounded-lg border border-zinc-50 bg-white p-6">
            <Section>
              {branding.brandingEnabled && branding.brandingLogo ? (
                <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-6" />
              ) : (
                <div className="bg-brand mb-6 w-[95%] items-center justify-center gap-2 rounded-md px-2 py-4">
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

              {/*  {customBody && <div dangerouslySetInnerHTML={{ __html: customBody }} />} */}

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
                recipientName={recipientName}
                documentDetails={documentDetails}
                tokenExpiration={tokenExpiration}
              />
            </Section>
          </Container>

          <Container className="flex w-full flex-col items-center justify-center gap-2 self-stretch rounded-lg border border-zinc-50 bg-white px-6 py-4">
            <TemplateFooter companyName={documentDetails?.companyName || ''} />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

export default DocumentInviteEmailTemplate;
