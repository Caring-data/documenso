import { Trans } from '@lingui/macro';

import { Section, Text } from '../components';

export interface TemplateDocumentPendingProps {
  documentName?: string;
  assetBaseUrl?: string;
  documentDetails?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    residentName?: string;
    locationName?: string;
  };
}

export const TemplateDocumentPending = ({ documentDetails }: TemplateDocumentPendingProps) => {
  return (
    <Section>
      <Text className="text-primary mb-0 text-center text-lg font-semibold">
        <Trans>“{documentDetails?.documentName}” has been signed</Trans>
      </Text>

      <Text className="text-xs font-medium leading-5 text-zinc-600">
        <Trans>
          We're still waiting for other signers to sign this document.
          <br />
          We'll notify you as soon as it's ready.
        </Trans>
      </Text>
    </Section>
  );
};

export default TemplateDocumentPending;
