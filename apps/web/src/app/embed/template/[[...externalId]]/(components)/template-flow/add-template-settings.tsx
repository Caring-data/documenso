'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { DropResult, SensorAPI } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { motion } from 'framer-motion';
import { Plus, Trash } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';

import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { ZRecipientAuthOptionsSchema } from '@documenso/lib/types/document-auth';
import type { TTemplate } from '@documenso/lib/types/template';
import { nanoid } from '@documenso/lib/universal/id';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { generateRecipientPlaceholder } from '@documenso/lib/utils/templates';
import {
  DocumentDistributionMethod,
  DocumentSigningOrder,
  DocumentVisibility,
  type Field,
  type Recipient,
  RecipientRole,
} from '@documenso/prisma/client';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { RecipientRoleSelect } from '@documenso/ui/components/recipient/recipient-role-select';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
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
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import { Input } from '@documenso/ui/primitives/input';
import { useStep } from '@documenso/ui/primitives/stepper';
import { toast } from '@documenso/ui/primitives/use-toast';

import type { TAddTemplateSettingsFormSchema } from './add-template-settings.types';
import { ZAddTemplateSettingsFormSchema } from './add-template-settings.types';

export type AddTemplateSettingsFormProps = {
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  fields: Field[];
  isDocumentPdfLoaded: boolean;
  template: TTemplate;
  signingOrder?: DocumentSigningOrder | null;
  onSubmit: (_data: TAddTemplateSettingsFormSchema) => void;
};

export const AddTemplateSettingsFormPartial = ({
  documentFlow,
  recipients,
  fields,
  isDocumentPdfLoaded,
  template,
  signingOrder,
  onSubmit,
}: AddTemplateSettingsFormProps) => {
  const initialId = useId();
  const $sensorApi = useRef<SensorAPI | null>(null);
  const { _ } = useLingui();

  const [placeholderRecipientCount, setPlaceholderRecipientCount] = useState(() =>
    recipients.length > 1 ? recipients.length + 1 : 2,
  );

  const { documentAuthOption } = extractDocumentAuthMethods({
    documentAuth: template.authOptions,
  });

  const templateLanguage = template.templateMeta?.language ?? 'en';

  // Generate default form signers
  const generateDefaultFormSigners = useCallback(() => {
    if (recipients.length === 0) {
      return [
        {
          formId: initialId,
          role: RecipientRole.SIGNER,
          actionAuth: undefined,
          ...generateRecipientPlaceholder(1),
          signingOrder: 1,
        },
      ];
    }

    let mappedRecipients = recipients.map((recipient, index) => ({
      nativeId: recipient.id,
      formId: String(recipient.id),
      name: recipient.name,
      email: recipient.email ?? '',
      role: recipient.role,
      actionAuth: ZRecipientAuthOptionsSchema.parse(recipient.authOptions)?.actionAuth ?? undefined,
      signingOrder: recipient.signingOrder ?? index + 1,
    }));

    mappedRecipients = mappedRecipients.sort(
      (a, b) => (a.signingOrder ?? 0) - (b.signingOrder ?? 0),
    );

    return mappedRecipients;
  }, [recipients, initialId]);

  const form = useForm<TAddTemplateSettingsFormSchema>({
    resolver: zodResolver(ZAddTemplateSettingsFormSchema),
    defaultValues: {
      title: template.title,
      externalId: template.externalId || undefined,
      visibility: DocumentVisibility.EVERYONE,
      globalAccessAuth: documentAuthOption?.globalAccessAuth || undefined,
      globalActionAuth: documentAuthOption?.globalActionAuth || undefined,
      signingOrder: signingOrder || DocumentSigningOrder.SEQUENTIAL,
      signers: generateDefaultFormSigners(),
      meta: {
        subject: template.templateMeta?.subject ?? '',
        message: template.templateMeta?.message ?? '',
        language: templateLanguage,
        timezone: template.templateMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
        dateFormat: templateLanguage === 'en' ? 'MM/dd/yyyy hh:mm a' : 'dd/MM/yyyy hh:mm a',
        distributionMethod: DocumentDistributionMethod.EMAIL,
        redirectUrl: '',
        emailSettings: {
          recipientSigningRequest: true,
          recipientRemoved: false,
          recipientSigned: false,
          documentPending: true,
          documentCompleted: true,
          documentDeleted: false,
          ownerDocumentCompleted: false,
        },
      },
    },
  });

  const { stepIndex, currentStep, totalSteps, previousStep } = useStep();

  const {
    formState: { errors, isSubmitting },
    control,
    watch,
    handleSubmit: formHandleSubmit,
    setValue,
    getValues,
  } = form;

  const watchedSigners = watch('signers');

  // Field array for managing signers
  const {
    append: appendSigner,
    fields: signers,
    remove: removeSigner,
  } = useFieldArray({
    control,
    name: 'signers',
  });

  // Update form when recipients change
  useEffect(() => {
    form.reset({
      ...form.getValues(),
      signers: generateDefaultFormSigners(),
      signingOrder: signingOrder || DocumentSigningOrder.SEQUENTIAL,
    });
  }, [form, recipients, generateDefaultFormSigners, signingOrder]);

  // Ensure name field has default values
  useEffect(() => {
    const currentSigners = watchedSigners;
    currentSigners.forEach((signer, index) => {
      if (!signer.name) {
        const defaultName = `Recipient ${index + 1}`;
        setValue(`signers.${index}.name`, defaultName);
      }
    });
  }, [watchedSigners, setValue]);

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

  // Utility functions
  const normalizeSigningOrders = useCallback((signers: typeof watchedSigners) => {
    return signers
      .sort((a, b) => (a.signingOrder ?? 0) - (b.signingOrder ?? 0))
      .map((signer, index) => ({ ...signer, signingOrder: index + 1 }));
  }, []);

  // Event handlers
  const onAddPlaceholderRecipient = useCallback(() => {
    const lastOrder = signers.length > 0 ? (signers[signers.length - 1]?.signingOrder ?? 0) : 0;

    appendSigner({
      formId: nanoid(12),
      role: RecipientRole.SIGNER,
      ...generateRecipientPlaceholder(placeholderRecipientCount),
      signingOrder: lastOrder + 1,
    });

    setPlaceholderRecipientCount((count) => count + 1);
  }, [appendSigner, signers, placeholderRecipientCount]);

  const onRemoveSigner = useCallback(
    (index: number) => {
      removeSigner(index);
      const updatedSigners = signers.filter((_, idx) => idx !== index);
      setValue('signers', normalizeSigningOrders(updatedSigners));
    },
    [removeSigner, signers, setValue, normalizeSigningOrders],
  );

  const handleRoleChange = useCallback(
    (index: number, role: RecipientRole) => {
      const currentSigners = getValues('signers');

      const updatedSigners = currentSigners.map((signer, idx) => ({
        ...signer,
        role: idx === index ? role : signer.role,
        signingOrder: idx + 1,
      }));

      setValue('signers', updatedSigners);

      // Warn if assistant is last signer
      if (role === RecipientRole.ASSISTANT && index === updatedSigners.length - 1) {
        toast({
          title: _(msg`Warning: Assistant as last signer`),
          description: _(
            msg`Having an assistant as the last signer means they will be unable to take any action as there are no subsequent signers to assist.`,
          ),
        });
      }
    },
    [getValues, setValue, _],
  );

  const handleSigningOrderChange = useCallback(
    (index: number, newOrderString: string) => {
      const trimmedOrderString = newOrderString.trim();
      if (!trimmedOrderString) return;

      const newOrder = Number(trimmedOrderString);
      if (!Number.isInteger(newOrder) || newOrder < 1) return;

      const currentSigners = getValues('signers');
      const signer = currentSigners[index];

      // Reorder signers
      const remainingSigners = currentSigners.filter((_, idx) => idx !== index);
      const newPosition = Math.min(Math.max(0, newOrder - 1), currentSigners.length - 1);
      remainingSigners.splice(newPosition, 0, signer);

      const updatedSigners = remainingSigners.map((s, idx) => ({
        ...s,
        signingOrder: idx + 1,
      }));

      setValue('signers', updatedSigners);

      if (signer.role === RecipientRole.ASSISTANT && newPosition === remainingSigners.length - 1) {
        toast({
          title: _(msg`Warning: Assistant as last signer`),
          description: _(
            msg`Having an assistant as the last signer means they will be unable to take any action as there are no subsequent signers to assist.`,
          ),
        });
      }
    },
    [getValues, setValue, _],
  );

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;

      const items = Array.from(watchedSigners);
      const [reorderedSigner] = items.splice(result.source.index, 1);
      const insertIndex = result.destination.index;

      items.splice(insertIndex, 0, reorderedSigner);

      const updatedSigners = items.map((signer, index) => ({
        ...signer,
        signingOrder: index + 1,
      }));

      setValue('signers', updatedSigners);

      // Check for assistant warning
      const lastSigner = updatedSigners[updatedSigners.length - 1];
      if (lastSigner.role === RecipientRole.ASSISTANT) {
        toast({
          title: _(msg`Warning: Assistant as last signer`),
          description: _(
            msg`Having an assistant as the last signer means they will be unable to take any action as there are no subsequent signers to assist.`,
          ),
        });
      }

      await form.trigger('signers');
    },
    [setValue, watchedSigners, _, form],
  );

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
            {/* Settings */}
            <div className="space-y-6">
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
            </div>

            <div className="border-t pt-6">
              <h3 className="mb-4 text-lg font-semibold">
                <Trans>Add Placeholders</Trans>
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                <Trans>
                  Set the number of recipients you'll later assign fields and signatures to.
                </Trans>
              </p>

              <AnimateGenericFadeInOut motionKey={'Show'}>
                <DragDropContext
                  onDragEnd={onDragEnd}
                  sensors={[
                    (api: SensorAPI) => {
                      $sensorApi.current = api;
                    },
                  ]}
                >
                  <Droppable droppableId="signers">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="mt-1 flex w-full flex-col gap-y-2"
                      >
                        {signers.map((signer, index) => (
                          <Draggable
                            key={`${signer.id}-${signer.signingOrder}`}
                            draggableId={signer.id}
                            index={index}
                            isDragDisabled={isSubmitting || !signer.signingOrder}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn('py-1', {
                                  'bg-widget-foreground pointer-events-none rounded-md pt-2':
                                    snapshot.isDragging,
                                })}
                              >
                                <motion.fieldset
                                  data-native-id={signer.nativeId}
                                  disabled={isSubmitting}
                                  className={cn(
                                    'grid items-end gap-2 pb-2',
                                    'grid-cols-1 gap-4',
                                    'sm:grid-cols-10 sm:gap-2 sm:pr-3',
                                    'md:grid-cols-12',
                                  )}
                                >
                                  <FormField
                                    control={form.control}
                                    name={`signers.${index}.name`}
                                    render={({ field }) => (
                                      <FormItem
                                        className={cn(
                                          'col-span-1',
                                          'sm:col-span-5',
                                          'md:col-span-9',
                                        )}
                                      >
                                        <FormControl>
                                          <Input
                                            placeholder={_(msg`Name`)}
                                            {...field}
                                            disabled={true}
                                          />
                                        </FormControl>

                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <div
                                    className={cn(
                                      'col-span-1 flex gap-x-2',
                                      'sm:col-span-3',
                                      'md:col-span-3',
                                      'justify-end sm:justify-start',
                                      'items-center',
                                      'min-w-0',
                                    )}
                                  >
                                    <FormField
                                      name={`signers.${index}.role`}
                                      render={({ field }) => (
                                        <FormItem className="min-w-0 flex-1">
                                          <FormControl>
                                            <RecipientRoleSelect
                                              {...field}
                                              onValueChange={(value) => {
                                                const roleValue = Object.values(RecipientRole).find(
                                                  (role) => role === value,
                                                );
                                                if (roleValue) {
                                                  handleRoleChange(index, roleValue);
                                                }
                                              }}
                                              disabled={isSubmitting}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <button
                                      type="button"
                                      className="inline-flex h-10 w-9 flex-shrink-0 items-center justify-center text-slate-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                                      disabled={isSubmitting || signers.length === 1}
                                      onClick={() => onRemoveSigner(index)}
                                    >
                                      <Trash className="h-4 w-4" />
                                    </button>
                                  </div>
                                </motion.fieldset>
                              </div>
                            )}
                          </Draggable>
                        ))}

                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>

                <FormErrorMessage
                  className="mt-1"
                  error={'signers__root' in errors && errors['signers__root']}
                />

                <div className="mt-6">
                  <Button
                    type="button"
                    className="w-full"
                    disabled={isSubmitting}
                    onClick={onAddPlaceholderRecipient}
                  >
                    <Plus className="-ml-1 mr-2 h-5 w-5" />
                    <Trans>Add Recipient</Trans>
                  </Button>
                </div>
              </AnimateGenericFadeInOut>
            </div>
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
          onGoNextClick={formHandleSubmit(onSubmit)}
        />
      </DocumentFlowFormContainerFooter>
    </div>
  );
};
