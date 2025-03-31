import { Trans } from '@lingui/macro';

import { Button, Section, Text } from '../components';

export interface TemplateDocumentCompletedProps {
  downloadLink: string;
  assetBaseUrl: string;
  recipientName?: string;
  documentDetails?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    residentName?: string;
    locationName?: string;
  };
}

export const TemplateDocumentCompleted = ({
  downloadLink,
  recipientName,
  documentDetails,
}: TemplateDocumentCompletedProps) => {
  return (
    <>
      <Section>
        <Section>
          <Text className="self-stretch text-sm font-medium leading-5 text-zinc-600">
            <Trans>Dear </Trans> {recipientName},
          </Text>
          <Text className="text-sm font-medium leading-5 text-zinc-600">
            <Trans>
              We are pleased to inform you that all required signatures have been completed, and the
              document{' '}
              <span className="text-brand-accent font-medium">{documentDetails?.documentName}</span>{' '}
              is now ready for download.
            </Trans>
          </Text>
          <Text className="text-sm font-medium leading-5 text-zinc-600">
            <Trans>
              You can access the final copy of the document by clicking the button below
            </Trans>
          </Text>
        </Section>

        <Section className="mt-6 text-center">
          <Button
            className="bg-brand inline-flex items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-medium text-white no-underline"
            href={downloadLink}
          >
            <Trans>Download</Trans>
          </Button>
        </Section>
      </Section>
    </>
  );
};

export default TemplateDocumentCompleted;
