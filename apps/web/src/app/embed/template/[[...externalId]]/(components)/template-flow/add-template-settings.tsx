'use client';

import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { InfoIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { SUPPORTED_LANGUAGES } from '@documenso/lib/constants/i18n';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import type { TTemplate } from '@documenso/lib/types/template';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { DocumentVisibility } from '@documenso/prisma/client';
import { DocumentDistributionMethod, type Field, type Recipient } from '@documenso/prisma/client';
import { DocumentEmailCheckboxes } from '@documenso/ui/components/document/document-email-checkboxes';
import { Combobox } from '@documenso/ui/primitives/combobox';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import { ShowFieldItem } from '@documenso/ui/primitives/document-flow/show-field-item';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Separator } from '@documenso/ui/primitives/separator';
import { useStep } from '@documenso/ui/primitives/stepper';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import type { TAddTemplateSettingsFormSchema } from './add-template-settings.types';
import { ZAddTemplateSettingsFormSchema } from './add-template-settings.types';

export type AddTemplateSettingsFormProps = {
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  fields: Field[];
  isDocumentPdfLoaded: boolean;
  template: TTemplate;
  onSubmit: (_data: TAddTemplateSettingsFormSchema) => void;
};

export const AddTemplateSettingsFormPartial = ({
  documentFlow,
  recipients,
  fields,
  isDocumentPdfLoaded,
  template,
  onSubmit,
}: AddTemplateSettingsFormProps) => {
  const { _ } = useLingui();

  const { documentAuthOption } = extractDocumentAuthMethods({
    documentAuth: template.authOptions,
  });

  const templateLanguage = template.templateMeta?.language ?? 'en';

  const form = useForm<TAddTemplateSettingsFormSchema>({
    resolver: zodResolver(ZAddTemplateSettingsFormSchema),
    defaultValues: {
      title: template.title,
      externalId: template.externalId || undefined,
      visibility: DocumentVisibility.EVERYONE,
      globalAccessAuth: documentAuthOption?.globalAccessAuth || undefined,
      globalActionAuth: documentAuthOption?.globalActionAuth || undefined,
      meta: {
        subject: template.templateMeta?.subject ?? '',
        message: template.templateMeta?.message ?? '',
        language: templateLanguage,
        timezone: template.templateMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
        dateFormat: templateLanguage === 'en' ? 'MM/dd/yyyy hh:mm a' : 'dd/MM/yyyy hh:mm a',
        distributionMethod: DocumentDistributionMethod.EMAIL,
        redirectUrl: '',
        emailSettings: ZDocumentEmailSettingsSchema.parse(template?.templateMeta?.emailSettings),
      },
    },
  });

  const { stepIndex, currentStep, totalSteps, previousStep } = useStep();

  const distributionMethod = form.watch('meta.distributionMethod');
  const emailSettings = form.watch('meta.emailSettings');

  useEffect(() => {
    if (!form.formState.touchedFields.meta?.timezone && !template.templateMeta?.timezone) {
      form.setValue('meta.timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [
    form,
    form.setValue,
    form.formState.touchedFields.meta?.timezone,
    template.templateMeta?.timezone,
  ]);

  return (
    <div className="flex h-full flex-col">
      <DocumentFlowFormContainerHeader
        title={documentFlow.title}
        description={documentFlow.description}
      />

      <DocumentFlowFormContainerContent>
        {isDocumentPdfLoaded &&
          fields.map((field, index) => (
            <ShowFieldItem key={index} field={field} recipients={recipients} />
          ))}

        <Form {...form}>
          <fieldset
            className="flex h-full flex-col space-y-6"
            disabled={form.formState.isSubmitting}
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    <Trans>Template title</Trans>
                  </FormLabel>

                  <FormControl>
                    <Input className="bg-background" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="meta.language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="inline-flex items-center">
                    <Trans>Language</Trans>
                    <Tooltip>
                      <TooltipTrigger>
                        <InfoIcon className="mx-2 h-4 w-4" />
                      </TooltipTrigger>

                      <TooltipContent className="text-foreground max-w-md space-y-2 p-4">
                        Controls the language for the document, including the language to be used
                        for email notifications, and the final certificate that is generated and
                        attached to the document.
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>

                  <FormControl>
                    <Select {...field} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {Object.entries(SUPPORTED_LANGUAGES).map(([code, language]) => (
                          <SelectItem key={code} value={code}>
                            {language.full}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {distributionMethod === DocumentDistributionMethod.EMAIL && (
              <>
                <Separator className="my-4" />

                <Label className="my-4 text-lg font-medium">
                  <Trans>Email Options</Trans>
                </Label>

                <FormField
                  control={form.control}
                  name="meta.subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>
                          Subject <span className="text-muted-foreground">(Optional)</span>
                        </Trans>
                      </FormLabel>

                      <FormControl>
                        <Input {...field} />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="meta.message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>
                          Message <span className="text-muted-foreground">(Optional)</span>
                        </Trans>
                      </FormLabel>

                      <FormControl>
                        <Textarea className="bg-background h-24" {...field} />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DocumentEmailCheckboxes
                  value={emailSettings}
                  onChange={(value) => form.setValue('meta.emailSettings', value)}
                  className="hidden"
                />
              </>
            )}

            <FormField
              control={form.control}
              name="meta.timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Time Zone</Trans>
                  </FormLabel>

                  <FormControl>
                    <Combobox
                      className="bg-background time-zone-field"
                      options={TIME_ZONES}
                      {...field}
                      onChange={(value) => value && field.onChange(value)}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>
        </Form>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep step={currentStep} maxStep={totalSteps} />

        <DocumentFlowFormContainerActions
          loading={form.formState.isSubmitting}
          disabled={form.formState.isSubmitting}
          canGoBack={stepIndex !== 0}
          onGoBackClick={previousStep}
          onGoNextClick={form.handleSubmit(onSubmit)}
        />
      </DocumentFlowFormContainerFooter>
    </div>
  );
};
