'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { DropResult, SensorAPI } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react';
import { motion } from 'framer-motion';
import { GripVerticalIcon, Plus, Trash } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';

import { ZRecipientAuthOptionsSchema } from '@documenso/lib/types/document-auth';
import { nanoid } from '@documenso/lib/universal/id';
import { generateRecipientPlaceholder } from '@documenso/lib/utils/templates';
import {
  DocumentSigningOrder,
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
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerStep,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import { DocumentFlowFormContainerHeader } from '@documenso/ui/primitives/document-flow/document-flow-root';
import { DocumentFlowFormContainerContent } from '@documenso/ui/primitives/document-flow/document-flow-root';
import { ShowFieldItem } from '@documenso/ui/primitives/document-flow/show-field-item';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { Form } from '@documenso/ui/primitives/form/form';
import {
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

import type { TAddTemplatePlacholderRecipientsFormSchema } from './add-template-placeholder-recipients.types';
import { ZAddTemplatePlacholderRecipientsFormSchema } from './add-template-placeholder-recipients.types';

export type AddTemplatePlaceholderRecipientsFormProps = {
  documentFlow: DocumentFlowStep;
  recipients: Recipient[];
  fields: Field[];
  signingOrder?: DocumentSigningOrder | null;
  isDocumentPdfLoaded: boolean;
  onSubmit: (_data: TAddTemplatePlacholderRecipientsFormSchema) => void;
};

export const AddTemplatePlaceholderRecipientsFormPartial = ({
  documentFlow,
  recipients,
  fields,
  signingOrder,
  isDocumentPdfLoaded,
  onSubmit,
}: AddTemplatePlaceholderRecipientsFormProps) => {
  const initialId = useId();
  const $sensorApi = useRef<SensorAPI | null>(null);
  const { _ } = useLingui();

  const [placeholderRecipientCount, setPlaceholderRecipientCount] = useState(() =>
    recipients.length > 1 ? recipients.length + 1 : 2,
  );

  const { currentStep, totalSteps, previousStep } = useStep();

  // Generate default form signers - always with sequential signing order
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

    // Always sort by signing order
    mappedRecipients = mappedRecipients.sort(
      (a, b) => (a.signingOrder ?? 0) - (b.signingOrder ?? 0),
    );

    return mappedRecipients;
  }, [recipients, initialId]);

  const form = useForm<TAddTemplatePlacholderRecipientsFormSchema>({
    resolver: zodResolver(ZAddTemplatePlacholderRecipientsFormSchema),
    defaultValues: {
      signers: generateDefaultFormSigners(),
      signingOrder: DocumentSigningOrder.SEQUENTIAL,
    },
  });

  const {
    formState: { errors, isSubmitting },
    control,
    watch,
    handleSubmit,
    setValue,
    getValues,
  } = form;

  const watchedSigners = watch('signers');

  // Update form when recipients change
  useEffect(() => {
    form.reset({
      signers: generateDefaultFormSigners(),
      signingOrder: DocumentSigningOrder.SEQUENTIAL,
    });
  }, [form, generateDefaultFormSigners]);

  // Field array for managing signers
  const {
    append: appendSigner,
    fields: signers,
    remove: removeSigner,
  } = useFieldArray({
    control,
    name: 'signers',
  });

  // Utility functions
  const normalizeSigningOrders = useCallback((signers: typeof watchedSigners) => {
    return signers
      .sort((a, b) => (a.signingOrder ?? 0) - (b.signingOrder ?? 0))
      .map((signer, index) => ({ ...signer, signingOrder: index + 1 }));
  }, []);

  // const isSignerDirectRecipient = useCallback(
  //   (signer: TAddTemplatePlacholderRecipientsFormSchema['signers'][number]): boolean => {
  //     return (
  //       templateDirectLink !== null &&
  //       signer.nativeId === templateDirectLink?.directTemplateRecipientId
  //     );
  //   },
  //   [templateDirectLink],
  // );

  // Event handlers
  const onFormSubmit = handleSubmit(onSubmit);

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
    [getValues, setValue, toast, _],
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

      // Warn about assistant placement
      if (signer.role === RecipientRole.ASSISTANT && newPosition === remainingSigners.length - 1) {
        toast({
          title: _(msg`Warning: Assistant as last signer`),
          description: _(
            msg`Having an assistant as the last signer means they will be unable to take any action as there are no subsequent signers to assist.`,
          ),
        });
      }
    },
    [getValues, setValue, toast, _],
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
    [setValue, watchedSigners, toast, _, form],
  );

  return (
    <div className="flex h-full flex-col">
      <DocumentFlowFormContainerHeader
        title={documentFlow.title}
        description={documentFlow.description}
      />

      <DocumentFlowFormContainerContent className="min-h-0 flex-1 p-0">
        {isDocumentPdfLoaded &&
          fields.map((field, index) => (
            <ShowFieldItem key={index} field={field} recipients={recipients} />
          ))}

        <AnimateGenericFadeInOut motionKey={'Show'}>
          <Form {...form}>
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
                    className="flex w-full flex-col gap-y-2"
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
                                control={control}
                                name={`signers.${index}.signingOrder`}
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-x-1 space-y-0 sm:col-span-2">
                                    <GripVerticalIcon className="hidden h-5 w-5 flex-shrink-0 opacity-40 sm:block" />
                                    <FormControl>
                                      <Input
                                        type="number"
                                        max={signers.length}
                                        className={cn(
                                          'w-full text-center',
                                          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                                        )}
                                        {...field}
                                        onChange={(e) => {
                                          field.onChange(e);
                                          handleSigningOrderChange(index, e.target.value);
                                        }}
                                        onBlur={(e) => {
                                          field.onBlur();
                                          handleSigningOrderChange(index, e.target.value);
                                        }}
                                        disabled={snapshot.isDragging || isSubmitting}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={control}
                                name={`signers.${index}.email`}
                                render={({ field }) => (
                                  <FormItem
                                    className={cn('col-span-1', 'sm:col-span-3', 'md:col-span-4')}
                                  >
                                    {index === 0 && (
                                      <FormLabel required className="block sm:hidden">
                                        <Trans>Email</Trans>
                                      </FormLabel>
                                    )}

                                    <FormControl>
                                      <Input
                                        type="email"
                                        placeholder={_(msg`Email`)}
                                        {...field}
                                        disabled={field.disabled || isSubmitting}
                                      />
                                    </FormControl>

                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={control}
                                name={`signers.${index}.name`}
                                render={({ field }) => (
                                  <FormItem
                                    className={cn('col-span-1', 'sm:col-span-3', 'md:col-span-4')}
                                  >
                                    <FormControl>
                                      <Input
                                        placeholder={_(msg`Name`)}
                                        {...field}
                                        disabled={field.disabled || isSubmitting}
                                      />
                                    </FormControl>

                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <div
                                className={cn(
                                  'col-span-1 flex gap-x-2',
                                  'sm:col-span-2',
                                  'justify-end sm:justify-start',
                                )}
                              >
                                <FormField
                                  name={`signers.${index}.role`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <RecipientRoleSelect
                                          {...field}
                                          onValueChange={(value) =>
                                            handleRoleChange(index, value as RecipientRole)
                                          }
                                          disabled={isSubmitting}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <button
                                  type="button"
                                  className="inline-flex h-10 w-10 items-center justify-center text-slate-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={isSubmitting || signers.length === 1}
                                  onClick={() => onRemoveSigner(index)}
                                >
                                  <Trash className="h-5 w-5" />
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
              className="mt-2"
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
          </Form>
        </AnimateGenericFadeInOut>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep step={currentStep} maxStep={totalSteps} />

        <DocumentFlowFormContainerActions
          loading={isSubmitting}
          disabled={isSubmitting}
          canGoBack={currentStep > 1}
          onGoBackClick={previousStep}
          onGoNextClick={onFormSubmit}
        />
      </DocumentFlowFormContainerFooter>
    </div>
  );
};
