'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { isValidLanguageCode } from '@documenso/lib/constants/i18n';
import {
  DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  SKIP_QUERY_BATCH_META,
} from '@documenso/lib/constants/trpc';
import { useSetTemplateRecipientsTemplate } from '@documenso/lib/server-only/recipient/use-set-template-recipients-template';
import { useGetDefaultFormTemplateConfig } from '@documenso/lib/server-only/template/get-default-form-template-config';
import { useUpdateFormTemplateSettings } from '@documenso/lib/server-only/template/update-form-template-settings';
import type { TTemplate } from '@documenso/lib/types/template';
import { type DocumentData } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { DocumentFlowFormContainer } from '@documenso/ui/primitives/document-flow/document-flow-root';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { Stepper } from '@documenso/ui/primitives/stepper';
import { useToast } from '@documenso/ui/primitives/use-toast';

import type { TAddTemplateFieldsFormSchema } from './(components)/template-flow/add-template-fields.types';
import type { TAddTemplatePlacholderRecipientsFormSchema } from './(components)/template-flow/add-template-placeholder-recipients.types';
import type { TAddTemplateSettingsFormSchema } from './(components)/template-flow/add-template-settings.types';

const LazyPDFViewer = dynamic(
  async () =>
    import('@documenso/ui/primitives/lazy-pdf-viewer').then((mod) => ({
      default: mod.LazyPDFViewer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center">Cargando documento...</div>
    ),
  },
);

const AddTemplateFieldsFormPartial = dynamic(
  async () =>
    import('./(components)/template-flow/add-template-fields').then((mod) => ({
      default: mod.AddTemplateFieldsFormPartial,
    })),
  { loading: () => <div>Cargando formulario...</div> },
);

const AddTemplatePlaceholderRecipientsFormPartial = dynamic(
  async () =>
    import('./(components)/template-flow/add-template-placeholder-recipients').then((mod) => ({
      default: mod.AddTemplatePlaceholderRecipientsFormPartial,
    })),
  { loading: () => <div>Cargando formulario...</div> },
);

const AddTemplateSettingsFormPartial = dynamic(
  async () =>
    import('./(components)/template-flow/add-template-settings').then((mod) => ({
      default: mod.AddTemplateSettingsFormPartial,
    })),
  { loading: () => <div>Cargando formulario...</div> },
);

export type EmbedTemplateClientPageProps = {
  templateId: number;
  externalId: string;
  documentData: DocumentData;
  initialTemplate: TTemplate;
};

type EditTemplateStep = 'settings' | 'signers' | 'fields';

const EDIT_TEMPLATE_STEPS: readonly EditTemplateStep[] = ['settings', 'signers', 'fields'] as const;

// const DATE_FORMAT_CONFIG = {
//   en: 'MM/dd/yyyy hh:mm a',
//   es: 'dd/MM/yyyy hh:mm a',
// } as const;

export const EmbedTemplateClientPage = ({
  templateId,
  externalId,
  documentData,
  initialTemplate,
}: EmbedTemplateClientPageProps) => {
  const { _ } = useLingui();

  const { toast } = useToast();

  const [hasDocumentLoaded, setHasDocumentLoaded] = useState(false);
  const [step, setStep] = useState<EditTemplateStep>('settings');

  const utils = trpc.useUtils();

  const {
    data: template,
    refetch: refetchTemplate,
    isLoading: isTemplateLoading,
    error: templateError,
  } = trpc.template.getTemplateByExternalId.useQuery(
    { externalId },
    {
      initialData: initialTemplate,
      ...SKIP_QUERY_BATCH_META,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  );

  const {
    data: defaultFormTemplateConfig,
    isLoading: isConfigLoading,
    error: configError,
  } = useGetDefaultFormTemplateConfig({
    templateId: template?.externalId || '',
  });

  const updateFormTemplateSettings = useUpdateFormTemplateSettings({
    externalId: template?.externalId || '',
  });

  const updateFormTemplateRecipients = useSetTemplateRecipientsTemplate({
    externalId: template?.externalId || '',
  });

  const { timezone: defaultTimezone } = defaultFormTemplateConfig || {};

  const templateData = useMemo(() => {
    if (!template) return { recipients: [], fields: [], templateDocumentData: documentData };

    return {
      recipients: template.recipients || [],
      fields: template.fields || [],
      templateDocumentData: template.templateDocumentData || documentData,
    };
  }, [template, documentData]);

  console.log(templateData);

  const documentFlow = useMemo(
    (): Record<EditTemplateStep, DocumentFlowStep> => ({
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
    }),
    [],
  );

  const { mutateAsync: updateTemplateSettings } =
    trpc.template.updateTemplateByExternalId.useMutation({
      ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
      onSuccess: (newData) => {
        utils.template.getTemplateById.setData(
          {
            templateId: templateId,
          },
          (oldData) => ({ ...(oldData || initialTemplate), ...newData }),
        );
      },
    });

  const { mutateAsync: setRecipients } = trpc.recipient.setTemplateRecipientsTemplate.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.template.getTemplateById.setData(
        {
          templateId: templateId,
        },
        (oldData) => ({ ...(oldData || initialTemplate), ...newData }),
      );
    },
  });

  const { mutateAsync: addTemplateFieldsForm } = trpc.field.addTemplateFieldsForm.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.template.getTemplateById.setData(
        {
          templateId: templateId,
        },
        (oldData) => ({ ...(oldData || initialTemplate), ...newData }),
      );
    },
  });

  const currentDocumentFlow = useMemo(() => documentFlow[step], [documentFlow, step]);

  const onAddSettingsFormSubmit = useCallback(
    async (data: TAddTemplateSettingsFormSchema) => {
      try {
        const requestData = {
          data: {
            title: data.title,
            externalId: data.externalId,
            visibility: data.visibility,
            globalAccessAuth: data.globalAccessAuth,
            globalActionAuth: data.globalActionAuth,
          },
          meta: {
            ...data.meta,
            language: isValidLanguageCode(data.meta.language) ? data.meta.language : undefined,
          },
        };

        await updateFormTemplateSettings.mutateAsync({
          requestData: {
            defaultLanguage: data.meta.language,
            defaultTimezone: data.meta.timezone,
            defaultEmailSubject: data.meta.subject,
            defaultEmailMessage: data.meta.message,
          },
        });

        await updateTemplateSettings({
          templateId: templateId,
          data: requestData.data,
          meta: requestData.meta,
        });

        toast({
          title: _(msg`Success`),
          description: _(msg`Template settings updated successfully.`),
          variant: 'default',
        });

        setStep('signers');
      } catch (error) {
        console.error('Error updating template settings:', error);
        toast({
          title: _(msg`Error`),
          description: _(msg`An error occurred while updating the document settings.`),
          variant: 'destructive',
        });
      }
    },
    [updateFormTemplateSettings, updateTemplateSettings, templateId, toast, _, setStep],
  );

  const onAddTemplatePlaceholderFormSubmit = useCallback(
    async (data: TAddTemplatePlacholderRecipientsFormSchema) => {
      console.log(data);
      try {
        await updateTemplateSettings({
          templateId: templateId,
          meta: {
            signingOrder: data.signingOrder,
          },
        });

        const recipients = await setRecipients({
          templateId: templateId,
          recipients: data.signers,
        });

        const recipientsData = recipients.recipients.map((recipient) => ({
          email: recipient.email,
          name: recipient.name,
          role: recipient.role,
          signingOrder: recipient.signingOrder,
          documensoSignerId: recipient.id,
        }));

        await updateFormTemplateRecipients.mutateAsync({
          requestData: recipientsData,
        });

        toast({
          title: _(msg`Success`),
          description: _(msg`Template recipients updated successfully.`),
          variant: 'default',
        });

        setStep('fields');
      } catch (error) {
        console.error('Error processing placeholder form:', error);
      }
    },
    [_, setRecipients, templateId, toast, updateFormTemplateRecipients, updateTemplateSettings],
  );

  const handleFieldsFormSubmit = useCallback(async (data: TAddTemplateFieldsFormSchema) => {
    try {
      await addTemplateFieldsForm({
        templateId: template.id,
        fields: data.fields,
      });

      await updateTemplateSettings({
        templateId: template.id,
        meta: {
          typedSignatureEnabled: data.typedSignatureEnabled,
        },
      });

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('field_')) {
          localStorage.removeItem(key);
        }
      }

      toast({
        title: _(msg`Template saved`),
        description: _(msg`Your templates has been saved successfully.`),
        duration: 5000,
      });
    } catch (error) {
      console.error(error);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while adding fields.`),
        variant: 'destructive',
      });
    }
  }, []);

  const handleDocumentLoad = useCallback(() => {
    setHasDocumentLoaded(true);
  }, []);

  const handleStepChange = useCallback((stepIndex: number) => {
    if (stepIndex >= 1 && stepIndex <= EDIT_TEMPLATE_STEPS.length) {
      setStep(EDIT_TEMPLATE_STEPS[stepIndex - 1]);
    }
  }, []);

  useEffect(() => {
    if (hasDocumentLoaded && typeof window !== 'undefined' && window.parent) {
      try {
        window.parent.postMessage(
          {
            action: 'document-ready',
            data: null,
          },
          '*',
        );
      } catch (error) {
        console.warn('Could not send message to parent window:', error);
      }
    }
  }, [hasDocumentLoaded]);

  useEffect(() => {
    if (step === 'settings') return;

    const timeoutId = setTimeout(() => {
      void refetchTemplate();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [step, refetchTemplate]);

  if (templateError || configError) {
    const error = templateError || configError;
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-red-600">Error cargando template</h2>
          <p className="text-gray-600">{error?.message || 'Error desconocido'}</p>
          <button
            onClick={async () => refetchTemplate()}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!template || !defaultFormTemplateConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-red-600">Template no encontrado</h2>
          <p className="text-gray-600">No se pudo cargar la configuración del template</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="min-w-0 flex-1 p-4 lg:p-6">
        <div className="mx-auto max-w-2xl">
          <Card className="relative rounded-xl shadow-lg before:rounded-xl" gradient>
            <CardContent className="p-2">
              {templateData.templateDocumentData && (
                <LazyPDFViewer
                  key={`pdf-${templateData.templateDocumentData.id}-${step}`}
                  documentData={templateData.templateDocumentData}
                  onDocumentLoad={handleDocumentLoad}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="bg-background fixed right-0 top-0 z-50 h-screen w-full max-w-md overflow-y-auto border-l shadow-xl lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl">
        <div className="flex h-full flex-col p-4 lg:p-6">
          <DocumentFlowFormContainer
            className="flex flex-1 flex-col"
            onSubmit={(e) => e.preventDefault()}
          >
            {isTemplateLoading || isConfigLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                  <p>Cargando template...</p>
                </div>
              </div>
            ) : (
              <Stepper
                currentStep={currentDocumentFlow.stepIndex}
                setCurrentStep={handleStepChange}
              >
                <AddTemplateSettingsFormPartial
                  key={`settings-${templateData.recipients.length}`}
                  template={{
                    ...template,
                    templateMeta: {
                      ...template.templateMeta,
                      timezone: template.templateMeta?.timezone || defaultTimezone,
                    },
                  }}
                  documentFlow={documentFlow.settings}
                  recipients={templateData.recipients}
                  fields={templateData.fields}
                  onSubmit={onAddSettingsFormSubmit}
                  isDocumentPdfLoaded={hasDocumentLoaded}
                />

                <AddTemplatePlaceholderRecipientsFormPartial
                  key={`signers-${templateData.recipients.length}`}
                  documentFlow={documentFlow.signers}
                  recipients={templateData.recipients}
                  fields={templateData.fields}
                  signingOrder={template?.templateMeta?.signingOrder}
                  isDocumentPdfLoaded={hasDocumentLoaded}
                  onSubmit={onAddTemplatePlaceholderFormSubmit}
                />

                <AddTemplateFieldsFormPartial
                  key={`fields-${templateData.fields.length}`}
                  documentFlow={documentFlow.fields}
                  recipients={templateData.recipients}
                  fields={templateData.fields}
                  onSubmit={handleFieldsFormSubmit}
                  typedSignatureEnabled={template?.templateMeta?.typedSignatureEnabled}
                />
              </Stepper>
            )}
          </DocumentFlowFormContainer>
        </div>
      </div>

      <div
        className="w-full max-w-md flex-shrink-0 lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl"
        aria-hidden="true"
      />
    </div>
  );
};
