'use client';

import { useEffect, useState } from 'react';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { SKIP_QUERY_BATCH_META } from '@documenso/lib/constants/trpc';
import type { TTemplate } from '@documenso/lib/types/template';
import { type DocumentData } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { DocumentFlowFormContainer } from '@documenso/ui/primitives/document-flow/document-flow-root';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { Stepper } from '@documenso/ui/primitives/stepper';

import { AddTemplatePlaceholderRecipientsFormPartial } from './(components)/template-flow/add-template-placeholder-recipients';
import type { TAddTemplatePlacholderRecipientsFormSchema } from './(components)/template-flow/add-template-placeholder-recipients.types';
import { AddTemplateSettingsFormPartial } from './(components)/template-flow/add-template-settings';
import type { TAddTemplateSettingsFormSchema } from './(components)/template-flow/add-template-settings.types';

export type EmbedTemplateClientPageProps = {
  templateId: number;
  externalId: string;
  documentData: DocumentData;
  initialTemplate: TTemplate;
};

type EditTemplateStep = 'settings' | 'signers' | 'fields';
const EditTemplateSteps: EditTemplateStep[] = ['settings', 'signers', 'fields'];

export const EmbedTemplateClientPage = ({
  templateId,
  externalId,
  documentData,
  initialTemplate,
}: EmbedTemplateClientPageProps) => {
  const { _ } = useLingui();

  const [hasDocumentLoaded, setHasDocumentLoaded] = useState(false);

  const [step, setStep] = useState<EditTemplateStep>('settings');

  const utils = trpc.useUtils();

  const { data: template, refetch: refetchTemplate } = trpc.template.getTemplateById.useQuery(
    {
      templateId,
    },
    {
      initialData: initialTemplate,
      ...SKIP_QUERY_BATCH_META,
    },
  );

  const { recipients, fields, templateDocumentData } = template;

  const documentFlow: Record<EditTemplateStep, DocumentFlowStep> = {
    settings: {
      title: msg`General`,
      description: msg`Configure general settings for the template.`,
      stepIndex: 1,
    },
    signers: {
      title: msg`Add Placeholders`,
      description: msg`Add all relevant placeholders for each recipient.`,
      stepIndex: 2,
    },
    fields: {
      title: msg`Add Fields`,
      description: msg`Add all relevant fields for each recipient.`,
      stepIndex: 3,
    },
  };

  const currentDocumentFlow = documentFlow[step];

  const onAddSettingsFormSubmit = (data: TAddTemplateSettingsFormSchema) => {
    setStep('signers');
  };

  const onAddTemplatePlaceholderFormSubmit = (data: TAddTemplatePlacholderRecipientsFormSchema) => {
    setStep('fields');
  };

  useEffect(() => {
    if (hasDocumentLoaded && window.parent) {
      window.parent.postMessage(
        {
          action: 'document-ready',
          data: null,
        },
        '*',
      );
    }
  }, [hasDocumentLoaded]);

  useEffect(() => {
    void refetchTemplate();
  }, [step]);

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-screen-lg flex-col items-center justify-center p-6">
      <div className="relative flex w-full flex-col gap-x-6 gap-y-12 md:flex-row">
        <div className="flex-1">
          <LazyPDFViewer
            documentData={documentData}
            onDocumentLoad={() => setHasDocumentLoaded(true)}
          />
        </div>

        <div className="group/document-widget fixed bottom-8 left-0 z-50 h-fit w-full flex-shrink-0 px-6 md:sticky md:top-4 md:z-auto md:w-[400px] md:px-0">
          <DocumentFlowFormContainer
            className="lg:h-[calc(100vh-2rem)]"
            onSubmit={(e) => e.preventDefault()}
          >
            <Stepper
              currentStep={currentDocumentFlow.stepIndex}
              setCurrentStep={(step) => setStep(EditTemplateSteps[step - 1])}
            >
              <AddTemplateSettingsFormPartial
                key={recipients.length}
                template={template}
                documentFlow={documentFlow.settings}
                recipients={recipients}
                fields={fields}
                onSubmit={onAddSettingsFormSubmit}
                isEnterprise={false}
                isDocumentPdfLoaded={hasDocumentLoaded}
              />

              <AddTemplatePlaceholderRecipientsFormPartial
                key={recipients.length}
                documentFlow={documentFlow.signers}
                recipients={recipients}
                fields={fields}
                signingOrder={template.templateMeta?.signingOrder}
                templateDirectLink={template.directLink}
                onSubmit={onAddTemplatePlaceholderFormSubmit}
                isEnterprise={false}
                isDocumentPdfLoaded={hasDocumentLoaded}
              />
            </Stepper>
          </DocumentFlowFormContainer>
        </div>
      </div>
    </div>
  );
};
