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

import type { TAddTemplateSettingsFormSchema } from './(components)/template-flow/add-template-settings.types';

// Shared loading component
const LoadingSpinner = () => (
  <div className="flex h-full items-center justify-center p-8">
    <div className="text-center">
      <div className="border-primary mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  </div>
);

// Dynamic imports - unified loading
const LazyPDFViewer = dynamic(
  async () => import('@documenso/ui/primitives/lazy-pdf-viewer').then((mod) => mod.LazyPDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted/20 flex h-96 items-center justify-center rounded-lg">
        <LoadingSpinner />
      </div>
    ),
  },
);

const AddTemplateFieldsFormPartial = dynamic(
  async () =>
    import('./(components)/template-flow/add-template-fields').then(
      (mod) => mod.AddTemplateFieldsFormPartial,
    ),
  { loading: LoadingSpinner },
);

const AddTemplateSettingsFormPartial = dynamic(
  async () =>
    import('./(components)/template-flow/add-template-settings').then(
      (mod) => mod.AddTemplateSettingsFormPartial,
    ),
  { loading: LoadingSpinner },
);

export type EmbedTemplateClientPageProps = {
  templateId: number;
  externalId: string;
  documentData: DocumentData;
  initialTemplate: TTemplate;
};

type EditTemplateStep = 'settings' | 'fields';
const EDIT_TEMPLATE_STEPS: readonly EditTemplateStep[] = ['settings', 'fields'] as const;

export const EmbedTemplateClientPage = ({
  templateId,
  externalId,
  documentData,
  initialTemplate,
}: EmbedTemplateClientPageProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  // Unified state management
  const [hasDocumentLoaded, setHasDocumentLoaded] = useState(false);
  const [step, setStep] = useState<EditTemplateStep>('settings');
  const [isProcessing, setIsProcessing] = useState(false);

  const utils = trpc.useUtils();

  // Unified query configuration
  const {
    data: template,
    refetch: refetchTemplate,
    isLoading: isTemplateLoading,
    isError: isTemplateError,
  } = trpc.template.getTemplateByExternalId.useQuery(
    { externalId },
    {
      initialData: initialTemplate,
      ...SKIP_QUERY_BATCH_META,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
    },
  );

  const {
    data: defaultFormTemplateConfig,
    isLoading: isConfigLoading,
    isError: isConfigError,
  } = useGetDefaultFormTemplateConfig({
    templateId: template?.externalId || '',
  });

  // Hooks
  const updateFormTemplateSettings = useUpdateFormTemplateSettings({
    externalId: template?.externalId || '',
  });

  const updateFormTemplateRecipients = useSetTemplateRecipientsTemplate({
    externalId: template?.externalId || '',
  });

  // Unified mutations
  const { mutateAsync: updateTemplateSettings } =
    trpc.template.updateTemplateByExternalId.useMutation({
      ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
      onSuccess: (newData) => {
        utils.template.getTemplateById.setData({ templateId }, (oldData) => ({
          ...(oldData || initialTemplate),
          ...newData,
        }));
      },
    });

  const { mutateAsync: setRecipients } = trpc.recipient.setTemplateRecipientsTemplate.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.template.getTemplateById.setData({ templateId }, (oldData) => ({
        ...(oldData || initialTemplate),
        ...newData,
      }));
    },
  });

  const { mutateAsync: addTemplateFieldsForm } = trpc.field.addTemplateFieldsForm.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.template.getTemplateById.setData({ templateId }, (oldData) => ({
        ...(oldData || initialTemplate),
        ...newData,
      }));
    },
  });

  // Memoized values
  const templateData = useMemo(
    () => ({
      recipients: template?.recipients || [],
      fields: template?.fields || [],
      templateDocumentData: template?.templateDocumentData || documentData,
    }),
    [template, documentData],
  );

  const documentFlow = useMemo(
    (): Record<EditTemplateStep, DocumentFlowStep> => ({
      settings: {
        title: msg`General`,
        description: msg`Configure general settings for the template.`,
        stepIndex: 1,
      },
      fields: {
        title: msg`Add Fields`,
        description: msg`Add all relevant fields for each recipient.`,
        stepIndex: 2,
      },
    }),
    [],
  );

  const currentDocumentFlow = useMemo(() => documentFlow[step], [documentFlow, step]);
  const isLoading = isTemplateLoading || isConfigLoading;
  const hasError = isTemplateError || isConfigError;

  // Unified event handlers
  const handleDocumentLoad = useCallback(() => setHasDocumentLoaded(true), []);

  const handleStepChange = useCallback((stepIndex: number) => {
    if (stepIndex >= 1 && stepIndex <= EDIT_TEMPLATE_STEPS.length) {
      setStep(EDIT_TEMPLATE_STEPS[stepIndex - 1]);
    }
  }, []);

  const postMessage = useCallback((action: string, data?: unknown) => {
    try {
      if (typeof window !== 'undefined' && window.parent) {
        window.parent.postMessage({ action, data }, '*');
      }
    } catch (error) {
      console.warn('Could not send message to parent window:', error);
    }
  }, []);

  // Unified form handlers with shared error handling pattern
  const createFormHandler = useCallback(
    (handler: (data: unknown) => Promise<void>, nextStep?: EditTemplateStep) => {
      return async (data: unknown) => {
        if (isProcessing) return;

        setIsProcessing(true);
        try {
          await handler(data);
          if (nextStep) setStep(nextStep);
        } catch (error) {
          console.error('Form submission error:', error);
          toast({
            title: _(msg`Error`),
            description: _(msg`An error occurred while processing the form.`),
            variant: 'destructive',
          });
        } finally {
          setIsProcessing(false);
        }
      };
    },
    [isProcessing, toast, _],
  );

  // Form handlers
  const onAddSettingsFormSubmit = createFormHandler(async (data) => {
    const typedData = data as TAddTemplateSettingsFormSchema;

    const requestData = {
      data: {
        title: typedData.title,
        externalId: typedData.externalId,
        visibility: typedData.visibility,
        globalAccessAuth: typedData.globalAccessAuth,
        globalActionAuth: typedData.globalActionAuth,
      },
      meta: {
        ...typedData.meta,
        language: isValidLanguageCode(typedData.meta.language)
          ? typedData.meta.language
          : undefined,
        signingOrder: typedData.signingOrder,
      },
    };

    await Promise.all([
      updateFormTemplateSettings.mutateAsync({
        requestData: {
          title: typedData.title,
          defaultLanguage: typedData.meta.language,
          defaultTimezone: typedData.meta.timezone,
          defaultEmailSubject: typedData.meta.subject,
          defaultEmailMessage: typedData.meta.message,
        },
      }),
      updateTemplateSettings({
        templateId,
        data: requestData.data,
        meta: requestData.meta,
      }),
    ]);

    if (typedData.signers && typedData.signers.length > 0) {
      const recipients = await setRecipients({
        templateId,
        recipients: typedData.signers,
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
    }
  }, 'fields');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFieldsFormSubmit = createFormHandler(async (data: any) => {
    await Promise.all([
      addTemplateFieldsForm({
        templateId: template?.id,
        fields: data.fields,
      }),
      updateTemplateSettings({
        templateId: template?.id,
        meta: { typedSignatureEnabled: data.typedSignatureEnabled },
      }),
    ]);

    // Cleanup localStorage
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('field_')) {
        localStorage.removeItem(key);
      }
    }

    toast({
      title: _(msg`Template saved`),
      description: _(msg`Your template has been saved successfully.`),
      duration: 5000,
    });

    postMessage('template-completed', null);
  });

  // Effects
  useEffect(() => {
    if (hasDocumentLoaded) postMessage('template-ready', null);
  }, [hasDocumentLoaded, postMessage]);

  useEffect(() => {
    if (step === 'settings') return;
    const timeoutId = setTimeout(() => void refetchTemplate(), 100);
    return () => clearTimeout(timeoutId);
  }, [step, refetchTemplate]);

  // Unified error handling
  if (hasError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="bg-destructive/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <div className="bg-destructive/20 text-destructive h-6 w-6 rounded-full">⚠</div>
          </div>
          <h2 className="text-destructive mb-2 text-lg font-semibold">Error loading template</h2>
          <p className="text-muted-foreground mb-4 text-sm">Please try again later</p>
          <button
            onClick={async () => refetchTemplate()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !template || !defaultFormTemplateConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* PDF Viewer */}
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

      {/* Form Section */}
      <div className="bg-background fixed right-0 top-0 z-50 h-screen w-full max-w-md overflow-y-auto border-l shadow-xl lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl">
        <div className="flex h-full flex-col p-4 lg:p-6">
          <DocumentFlowFormContainer
            className="flex flex-1 flex-col"
            onSubmit={(e) => e.preventDefault()}
          >
            <Stepper currentStep={currentDocumentFlow.stepIndex} setCurrentStep={handleStepChange}>
              <AddTemplateSettingsFormPartial
                key={`settings-${templateData.recipients.length}`}
                template={{
                  ...template,
                  // @ts-expect-error - timezone override for template meta
                  templateMeta: {
                    ...template.templateMeta,
                    timezone: template.templateMeta?.timezone || defaultFormTemplateConfig.timezone,
                  },
                }}
                documentFlow={documentFlow.settings}
                recipients={templateData.recipients}
                fields={templateData.fields}
                onSubmit={onAddSettingsFormSubmit}
                isDocumentPdfLoaded={hasDocumentLoaded}
                signingOrder={template?.templateMeta?.signingOrder}
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
          </DocumentFlowFormContainer>
        </div>
      </div>

      {/* Spacer */}
      <div
        className="w-full max-w-md flex-shrink-0 lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl"
        aria-hidden="true"
      />

      {/* Processing overlay */}
      {isProcessing && (
        <div className="bg-background/80 fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-background flex items-center gap-3 rounded-lg p-4 shadow-lg">
            <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"></div>
            <span className="text-sm font-medium">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
};
