import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Img, Preview, Section } from '../components';
import { useBranding } from '../providers/branding';
import type { TemplateDocumentPendingProps } from '../template-components/template-document-pending';
import { TemplateDocumentPending } from '../template-components/template-document-pending';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentPendingEmailTemplateProps = Partial<TemplateDocumentPendingProps>;

export const DocumentPendingEmailTemplate = ({
  documentName = 'Open Source Pledge.pdf',
  assetBaseUrl = 'http://localhost:3002',
  documentDetails,
}: DocumentPendingEmailTemplateProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const previewText = msg`Pending Document`;

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
                      src={getAssetUrl('/static/file-pen-line.png')}
                      alt="icon image - file pen line"
                      className="mb-4 h-8"
                    />
                    <p className="text-center text-lg font-medium text-white">
                      <Trans>Waiting for others</Trans>
                    </p>
                  </div>
                )}

                {/*  {customBody && <div dangerouslySetInnerHTML={{ __html: customBody }} />} */}

                <TemplateDocumentPending
                  documentName={documentName}
                  assetBaseUrl={assetBaseUrl}
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

export default DocumentPendingEmailTemplate;
