import { Trans } from '@lingui/macro';

import { Section, Text } from '../components';

export interface TemplateDocumentRecipientSignedProps {
  recipientName: string;
  recipientEmail: string;
  documentDetails?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    residentName?: string;
  };
}

export const TemplateDocumentRecipientSigned = ({
  recipientName,
  recipientEmail,
  documentDetails,
}: TemplateDocumentRecipientSignedProps) => {
  const recipientReference = recipientName || recipientEmail;

  return (
    <Section>
      <Text className="text-primary mb-0 text-center text-lg font-semibold">
        <Trans>
          {recipientReference} has signed "{documentDetails?.documentName}"
        </Trans>
      </Text>

      <Text className="text-xs font-medium leading-5 text-zinc-600">
        <Trans>{recipientReference} has completed signing the document.</Trans>
      </Text>
    </Section>
  );
};

export default TemplateDocumentRecipientSigned;
