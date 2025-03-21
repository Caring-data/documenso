import { Trans } from '@lingui/macro';

import { Container, Section, Text } from '../components';

interface TemplateDocumentRejectionConfirmedProps {
  recipientName: string;
  documentName: string;
  documentOwnerName: string;
  reason?: string;
  documentDetails?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    residentName?: string;
    locationName?: string;
  };
}

export function TemplateDocumentRejectionConfirmed({
  reason,
  documentDetails,
}: TemplateDocumentRejectionConfirmedProps) {
  return (
    <Container>
      <Section>
        <Text className="text-primary text-base">
          <Trans>
            This email confirms that you have rejected the document{' '}
            <strong className="font-bold">"{documentDetails?.documentName}"</strong> sent by{' '}
            {documentDetails?.facilityAdministrator}.
          </Trans>
        </Text>

        {reason && (
          <Text className="text-base font-medium text-slate-400">
            <Trans>Rejection reason: {reason}</Trans>
          </Text>
        )}

        <Text className="text-base">
          <Trans>
            The document owner has been notified of this rejection. No further action is required
            from you at this time. The document owner may contact you with any questions regarding
            this rejection.
          </Trans>
        </Text>
      </Section>
    </Container>
  );
}
