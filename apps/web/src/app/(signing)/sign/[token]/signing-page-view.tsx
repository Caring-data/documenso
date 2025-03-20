'use client';

import { useEffect, useState } from 'react';

import { useSearchParams } from 'next/navigation';
import { usePathname } from 'next/navigation';

import { Loader } from 'lucide-react';
import { match } from 'ts-pattern';

import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import type { DocumentAndSender } from '@documenso/lib/server-only/document/get-document-by-token';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import type { CompletedField } from '@documenso/lib/types/fields';
import type { Field } from '@documenso/prisma/client';
import { FieldType, RecipientRole } from '@documenso/prisma/client';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import type { RecipientWithFields } from '@documenso/prisma/types/recipient-with-fields';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';

import { DocumentReadOnlyFields } from '~/components/document/document-read-only-fields';

import { AutoSign } from './auto-sign';
import { CheckboxField } from './checkbox-field';
import { DateField } from './date-field';
import { DropdownField } from './dropdown-field';
import { EmailField } from './email-field';
import { SigningForm } from './form';
import { InitialsField } from './initials-field';
import { NameField } from './name-field';
import { NumberField } from './number-field';
import { RadioField } from './radio-field';
import { RecipientProvider } from './recipient-context';
import { RejectDocumentDialog } from './reject-document-dialog';
import { SignatureField } from './signature-field';
import { TextField } from './text-field';

export type SigningPageViewProps = {
  document: DocumentAndSender;
  recipient: RecipientWithFields;
  fields: Field[];
  completedFields: CompletedField[];
  isRecipientsTurn: boolean;
  allRecipients?: RecipientWithFields[];
  token?: string;
};

interface DocumentDetails {
  documentName?: string;
  facilityAdministrator?: string;
  residentName?: string;
}

export const SigningPageView = ({
  document,
  recipient,
  fields,
  completedFields,
  isRecipientsTurn,
  allRecipients = [],
  token,
}: SigningPageViewProps) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const assetBaseUrl = WEBAPP_BASE_URL;

  const extractedToken = token || (pathname ? pathname.split('/')[2] : '');
  const hasVisitedPreSignPage = searchParams?.get('accessed') === 'true';

  const { documentData, documentMeta } = document;
  const [selectedSignerId, setSelectedSignerId] = useState<number | null>(allRecipients?.[0]?.id);

  useEffect(() => {
    if (!hasVisitedPreSignPage && extractedToken) {
      sessionStorage.setItem('preSigningData', JSON.stringify(document?.documentDetails ?? {}));

      window.location.href = `/sign/${extractedToken}/pre-signing`;
    }
  }, [hasVisitedPreSignPage, extractedToken, document]);

  const selectedSigner = allRecipients?.find((r) => r.id === selectedSignerId);

  if (!hasVisitedPreSignPage && extractedToken) {
    return (
      <div className="flex h-screen items-center justify-center text-lg font-semibold text-gray-700">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  const isValidDocumentDetails = (details: unknown): details is DocumentDetails => {
    return typeof details === 'object' && details !== null && 'documentName' in details;
  };

  const normalizedDocument = {
    ...document,
    documentDetails: isValidDocumentDetails(document.documentDetails)
      ? document.documentDetails
      : {},
  };

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <RecipientProvider recipient={recipient} targetSigner={selectedSigner ?? null}>
      <header className="fixed left-0 top-0 z-50 flex w-full items-center bg-white px-6 py-3 shadow-md">
        <img src={getAssetUrl('/static/logo-bg-white.png')} alt="Logo" className="h-8 w-auto" />
      </header>
      <div className="mx-auto mb-8 mt-20 w-full max-w-screen-xl md:mb-12">
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-6">
          <div className="max-w-[50ch]">
            <h1
              className="mt-4 block max-w-[20rem] truncate text-lg font-semibold md:max-w-[30rem] md:text-3xl"
              title={normalizedDocument.documentDetails.documentName ?? 'Untitled Document'}
            >
              {normalizedDocument.documentDetails.documentName ?? 'Untitled Document'}
            </h1>
          </div>

          <RejectDocumentDialog document={document} token={recipient.token} />
        </div>

        <div className="mt-8 grid grid-cols-12 gap-y-8 lg:gap-x-8 lg:gap-y-0">
          <Card
            className="col-span-12 rounded-xl before:rounded-xl lg:col-span-7 xl:col-span-8"
            gradient
          >
            <CardContent className="p-2">
              <LazyPDFViewer
                key={documentData.id}
                documentData={documentData}
                document={document}
                password={documentMeta?.password}
              />
            </CardContent>
          </Card>

          <div className="col-span-12 lg:col-span-5 xl:col-span-4">
            <SigningForm
              document={document}
              recipient={recipient}
              fields={fields}
              redirectUrl={documentMeta?.redirectUrl}
              isRecipientsTurn={isRecipientsTurn}
              allRecipients={allRecipients}
              setSelectedSignerId={setSelectedSignerId}
            />
          </div>
        </div>

        <DocumentReadOnlyFields fields={completedFields} />

        {recipient.role !== RecipientRole.ASSISTANT && (
          <AutoSign recipient={recipient} fields={fields} />
        )}

        <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
          {fields
            .filter(
              (field) =>
                recipient.role !== RecipientRole.ASSISTANT ||
                field.recipientId === selectedSigner?.id,
            )
            .map((field) =>
              match(field.type)
                .with(FieldType.SIGNATURE, () => (
                  <SignatureField
                    key={field.id}
                    field={field}
                    typedSignatureEnabled={documentMeta?.typedSignatureEnabled}
                  />
                ))
                .with(FieldType.INITIALS, () => <InitialsField key={field.id} field={field} />)
                .with(FieldType.NAME, () => <NameField key={field.id} field={field} />)
                .with(FieldType.DATE, () => (
                  <DateField
                    key={field.id}
                    field={field}
                    dateFormat={documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT}
                    timezone={documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE}
                  />
                ))
                .with(FieldType.EMAIL, () => <EmailField key={field.id} field={field} />)
                .with(FieldType.TEXT, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZTextFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <TextField key={field.id} field={fieldWithMeta} />;
                })
                .with(FieldType.NUMBER, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZNumberFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <NumberField key={field.id} field={fieldWithMeta} />;
                })
                .with(FieldType.RADIO, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZRadioFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <RadioField key={field.id} field={fieldWithMeta} />;
                })
                .with(FieldType.CHECKBOX, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZCheckboxFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <CheckboxField key={field.id} field={fieldWithMeta} />;
                })
                .with(FieldType.DROPDOWN, () => {
                  const fieldWithMeta: FieldWithSignatureAndFieldMeta = {
                    ...field,
                    fieldMeta: field.fieldMeta ? ZDropdownFieldMeta.parse(field.fieldMeta) : null,
                  };
                  return <DropdownField key={field.id} field={fieldWithMeta} />;
                })
                .otherwise(() => null),
            )}
        </ElementVisible>
      </div>
    </RecipientProvider>
  );
};
