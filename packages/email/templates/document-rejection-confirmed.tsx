import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Img, Preview, Section } from '../components';
import { useBranding } from '../providers/branding';
import { TemplateDocumentRejectionConfirmed } from '../template-components/template-document-rejection-confirmed';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentRejectionConfirmedEmailProps = {
  recipientName: string;
  documentName: string;
  documentOwnerName: string;
  reason: string;
  assetBaseUrl?: string;
  documentDetails?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    residentName?: string;
    locationName?: string;
  };
};

export function DocumentRejectionConfirmedEmail({
  recipientName,
  documentName,
  documentOwnerName,
  reason,
  assetBaseUrl = 'http://localhost:3002',
  documentDetails,
}: DocumentRejectionConfirmedEmailProps) {
  const { _ } = useLingui();
  const branding = useBranding();

  const previewText = _(msg`You have rejected the document '${documentName}'`);

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body className="mx-auto my-auto bg-white font-sans">
        <div className="mx-auto my-auto flex w-full flex-col items-center justify-center gap-6 rounded-lg bg-zinc-50 p-6">
          <Section>
            <Container className="mb-4 flex w-full flex-col items-center justify-center gap-1 self-stretch rounded-lg border border-zinc-50 bg-white p-6">
              <Section>
                {branding.brandingEnabled && branding.brandingLogo ? (
                  <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-6" />
                ) : (
                  <div className="bg-brand mb-6 w-[97%] items-center justify-center gap-2 rounded-md px-2 py-4">
                    <p className="text-center text-lg font-medium text-white">
                      Rejection Confirmed
                    </p>
                  </div>
                )}

                <TemplateDocumentRejectionConfirmed
                  recipientName={recipientName}
                  documentName={documentName}
                  documentOwnerName={documentOwnerName}
                  reason={reason}
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
}

export default DocumentRejectionConfirmedEmail;
