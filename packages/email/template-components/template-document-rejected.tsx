import { Trans } from '@lingui/macro';

import { Button, Text } from '../components';

export interface TemplateDocumentRejectedProps {
  rejectionReason?: string;
  documentUrl: string;
  recipientName?: string;
  documentName: string;
}

export function TemplateDocumentRejected({
  rejectionReason,
  documentUrl,
  recipientName: signerName,
  documentName,
}: TemplateDocumentRejectedProps) {
  return (
    <div className="mt-4">
      <Text className="mb-4 text-base">
        <Trans>
          {signerName} has rejected the document "{documentName}".
        </Trans>
      </Text>

      {rejectionReason && (
        <Text className="mb-4 text-base text-slate-400">
          <Trans>Reason for rejection: {rejectionReason}</Trans>
        </Text>
      )}

      <Text className="mb-6 text-base">
        <Trans>You can view the document and its status by clicking the button below.</Trans>
      </Text>
      <div className="mt-6 text-center">
        <Button
          href={documentUrl}
          className="bg-brand inline-flex items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-medium text-white no-underline"
        >
          <Trans>View Document</Trans>
        </Button>
      </div>
    </div>
  );
}
