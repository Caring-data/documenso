import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Img, Preview, Section } from '../components';
import { useBranding } from '../providers/branding';
import type { TemplateDocumentCompletedProps } from '../template-components/template-document-completed';
import { TemplateDocumentCompleted } from '../template-components/template-document-completed';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentCompletedEmailTemplateProps = Partial<TemplateDocumentCompletedProps> & {
  downloadLink?: string;
  customBody?: string;
  recipientName?: string;
  documentDetails?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    residentName?: string;
    locationName?: string;
  };
};

export const DocumentCompletedEmailTemplate = ({
  downloadLink = 'https://documenso.com',
  assetBaseUrl = 'http://localhost:3002',
  customBody,
  recipientName,
  documentDetails,
}: DocumentCompletedEmailTemplateProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const previewText = msg`Completed Document`;

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>
      <Body className="mx-auto my-auto font-sans">
        <div className="mx-auto my-auto flex w-full flex-col items-center justify-center gap-6 rounded-lg bg-zinc-50 p-6">
          <Section>
            <Container className="mb-4 flex w-full flex-col items-center justify-center gap-1 self-stretch rounded-lg border border-zinc-50 bg-white p-6">
              <Section>
                {branding.brandingEnabled && branding.brandingLogo ? (
                  <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-6" />
                ) : (
                  <div className="bg-brand mb-6 w-[97%] items-center justify-center gap-1 rounded-md px-2 py-4 text-center">
                    <div className="text-center text-white">
                      <Img
                        src={getAssetUrl('/static/file-check.png')}
                        alt="icon image - file check"
                        className="inline h-8"
                      />
                    </div>
                    <p className="text-center text-lg font-medium text-white">
                      <Trans>Final Document Available for Download</Trans>
                    </p>
                  </div>
                )}

                {/*  {customBody && <div dangerouslySetInnerHTML={{ __html: customBody }} />} */}

                <TemplateDocumentCompleted
                  downloadLink={downloadLink}
                  assetBaseUrl={assetBaseUrl}
                  recipientName={recipientName}
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

export default DocumentCompletedEmailTemplate;
