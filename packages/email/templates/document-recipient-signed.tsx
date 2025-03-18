import { msg } from '@lingui/macro';
import { Trans } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Img, Preview, Section } from '../components';
import { useBranding } from '../providers/branding';
import { TemplateDocumentRecipientSigned } from '../template-components/template-document-recipient-signed';
import { TemplateFooter } from '../template-components/template-footer';

export interface DocumentRecipientSignedEmailTemplateProps {
  documentName?: string;
  recipientName?: string;
  recipientEmail?: string;
  assetBaseUrl?: string;
  documentDetails?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    residentName?: string;
  };
}

export const DocumentRecipientSignedEmailTemplate = ({
  documentName = 'Open Source Pledge.pdf',
  recipientName = 'John Doe',
  recipientEmail = 'lucas@documenso.com',
  assetBaseUrl = 'http://localhost:3002',
  documentDetails,
}: DocumentRecipientSignedEmailTemplateProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const recipientReference = recipientName || recipientEmail;

  const previewText = msg`${recipientReference} has signed ${documentName}`;

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="mx-auto my-auto bg-white font-sans">
        <div className="mx-auto my-auto flex w-full flex-col items-center justify-center gap-6 rounded-lg bg-zinc-50 p-6">
          <Section>
            <Container className="mb-4 flex w-full flex-col items-center justify-center gap-1 self-stretch rounded-lg border border-zinc-50 bg-white p-6">
              <Section>
                {branding.brandingEnabled && branding.brandingLogo ? (
                  <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-6" />
                ) : (
                  <div className="bg-brand mb-6 w-[97%] items-center justify-center gap-2 rounded-md px-2 py-4">
                    <Img
                      src={getAssetUrl('/static/file-check.png')}
                      alt="icon image - file check"
                      className="mb-4 h-8"
                    />
                    <p className="text-center text-lg font-medium text-white">
                      <Trans>Completed</Trans>
                    </p>
                  </div>
                )}

                {/*  {customBody && <div dangerouslySetInnerHTML={{ __html: customBody }} />} */}

                <TemplateDocumentRecipientSigned
                  recipientName={recipientName}
                  recipientEmail={recipientEmail}
                  documentDetails={documentDetails}
                />
              </Section>
            </Container>

            <Container className="flex w-full flex-col items-center justify-center gap-2 self-stretch rounded-lg border border-zinc-50 bg-white px-6 py-4">
              <TemplateFooter companyName={documentDetails?.companyName || ''} />
            </Container>
          </Section>
        </div>
      </Body>
    </Html>
  );
};

export default DocumentRecipientSignedEmailTemplate;
