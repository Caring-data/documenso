import { Trans } from '@lingui/macro';

import { Img, Section, Text } from '../components';

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
  recipientName?: string;
}

export const TemplateDocumentPending = ({
  documentDetails,
  assetBaseUrl,
  recipientName,
}: TemplateDocumentPendingProps) => {
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Section>
      <Text className="self-stretch text-sm font-medium leading-5 text-zinc-600">
        <Trans>Dear </Trans> {recipientName},
      </Text>
      <Text className="mb-0 text-center text-base font-semibold leading-5 text-zinc-600">
        <Trans>“{documentDetails?.documentName}” has been signed</Trans>
      </Text>
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
          src={getAssetUrl('/static/file-clock.png')}
          alt="Document Icon"
          className="my-auto h-4 w-auto pr-2 align-middle"
        />
        <div className="flex flex-col text-sm font-medium leading-5 text-zinc-600">
          <Text>
            <Trans>
              Status: We're still waiting for other signers to sign this document.
              <br />
              We'll notify you as soon as it's ready.
            </Trans>
          </Text>
        </div>
      </div>
    </Section>
  );
};

export default TemplateDocumentPending;
