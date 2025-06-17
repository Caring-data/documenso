import { Trans } from '@lingui/macro';

import { Button, Img, Section, Text } from '../components';

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
  assetBaseUrl,
}: TemplateDocumentCompletedProps) => {
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <>
      <Section>
        <Section>
          <Text className="self-stretch text-sm font-medium leading-5 text-zinc-600">
            <Trans>Dear </Trans> {recipientName},
          </Text>
          <Text className="text-sm font-medium leading-5 text-zinc-600">
            <Trans>
              We are pleased to inform you that all required signatures have been completed. The
              following document is now ready for download:
            </Trans>
          </Text>
          <div className="flex items-center gap-6">
            <Img
              src={getAssetUrl('/static/user-round.png')}
              alt="Document Icon"
              className="my-auto h-4 w-auto pr-2 align-middle"
            />
            <div className="flex flex-col text-sm font-medium leading-5 text-zinc-600">
              <Text>
                <Trans>Regarding: {documentDetails?.residentName}</Trans>
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Img
              src={getAssetUrl('/static/file-text.png')}
              alt="Document Icon"
              className="my-auto h-4 w-auto pr-2 align-middle"
            />
            <div className="flex flex-col justify-center text-sm font-medium leading-5 text-zinc-600">
              <Text>
                <Trans>Document: {documentDetails?.documentName}</Trans>
              </Text>
            </div>
          </div>

          <Text className="text-sm font-medium leading-5 text-zinc-600">
            <Trans>You can download the final copy by clicking the button below</Trans>
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
