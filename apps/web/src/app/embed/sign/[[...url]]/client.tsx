'use client';

import { useEffect, useId, useLayoutEffect, useState } from 'react';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { LucideChevronDown, LucideChevronUp } from 'lucide-react';

import { useThrottleFn } from '@documenso/lib/client-only/hooks/use-throttle-fn';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { validateFieldsInserted } from '@documenso/lib/utils/fields';
import type { DocumentMeta, TemplateMeta } from '@documenso/prisma/client';
import {
  type DocumentData,
  type Field,
  FieldType,
  RecipientRole,
  SigningStatus,
} from '@documenso/prisma/client';
import type { RecipientWithFields } from '@documenso/prisma/types/recipient-with-fields';
import { trpc } from '@documenso/trpc/react';
import { FieldToolTip } from '@documenso/ui/components/field/field-tooltip';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredSigningContext } from '~/app/(signing)/sign/[token]/provider';
import { RecipientProvider } from '~/app/(signing)/sign/[token]/recipient-context';
import { RejectDocumentDialog } from '~/app/(signing)/sign/[token]/reject-document-dialog';
import { SignaturePad } from '~/app/(signing)/sign/[token]/signature-pad';
import { Logo } from '~/components/branding/logo';

import { EmbedClientLoading } from '../../client-loading';
import { EmbedDocumentCompleted } from '../../completed';
import { EmbedDocumentFields } from '../../document-fields';
import { EmbedDocumentRejected } from '../../rejected';
import { injectCss } from '../../util';
import { ZSignDocumentEmbedDataSchema } from './schema';

export type EmbedSignDocumentClientPageProps = {
  token: string;
  documentId: number;
  documentData: DocumentData;
  recipient: RecipientWithFields;
  fields: Field[];
  metadata?: DocumentMeta | TemplateMeta | null;
  isCompleted?: boolean;
  hidePoweredBy?: boolean;
  isPlatformOrEnterprise?: boolean;
  allRecipients?: RecipientWithFields[];
};

export const EmbedSignDocumentClientPage = ({
  token,
  documentId,
  documentData,
  recipient,
  fields,
  metadata,
  isCompleted,
  hidePoweredBy = false,
  isPlatformOrEnterprise = false,
  allRecipients = [],
}: EmbedSignDocumentClientPageProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const {
    fullName,
    email,
    signature,
    signatureValid,
    setFullName,
    setSignature,
    setSignatureValid,
  } = useRequiredSigningContext();

  const [hasFinishedInit, setHasFinishedInit] = useState(false);
  const [hasDocumentLoaded, setHasDocumentLoaded] = useState(false);
  const [hasCompletedDocument, setHasCompletedDocument] = useState(isCompleted);
  const [hasRejectedDocument, setHasRejectedDocument] = useState(
    recipient.signingStatus === SigningStatus.REJECTED,
  );
  const [selectedSignerId, setSelectedSignerId] = useState<number | null>(
    allRecipients.length > 0 ? allRecipients[0].id : null,
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [isNameLocked, setIsNameLocked] = useState(false);
  const [showPendingFieldTooltip, setShowPendingFieldTooltip] = useState(false);

  const [allowDocumentRejection, setAllowDocumentRejection] = useState(false);

  const selectedSigner = allRecipients.find((r) => r.id === selectedSignerId);
  const isAssistantMode = recipient.role === RecipientRole.ASSISTANT;

  const [throttledOnCompleteClick, isThrottled] = useThrottleFn(() => void onCompleteClick(), 500);

  const [pendingFields, _completedFields] = [
    fields.filter((field) => field.recipientId === recipient.id && !field.inserted),
    fields.filter((field) => field.inserted),
  ];

  const { mutateAsync: completeDocumentWithToken, isPending: isSubmitting } =
    trpc.recipient.completeDocumentWithToken.useMutation();

  const hasSignatureField = fields.some((field) => field.type === FieldType.SIGNATURE);

  const assistantSignersId = useId();

  const onNextFieldClick = () => {
    validateFieldsInserted(fields);

    setShowPendingFieldTooltip(true);
    setIsExpanded(false);
  };

  const onCompleteClick = async () => {
    try {
      if (hasSignatureField && !signatureValid) {
        return;
      }

      const valid = validateFieldsInserted(fields);

      if (!valid) {
        setShowPendingFieldTooltip(true);
        return;
      }

      await completeDocumentWithToken({
        documentId,
        token,
      });

      if (window.parent) {
        window.parent.postMessage(
          {
            action: 'document-completed',
            data: {
              token,
              documentId,
              recipientId: recipient.id,
            },
          },
          '*',
        );
      }

      setHasCompletedDocument(true);
    } catch (err) {
      if (window.parent) {
        window.parent.postMessage(
          {
            action: 'document-error',
            data: null,
          },
          '*',
        );
      }

      toast({
        title: _(msg`Something went wrong`),
        description: _(
          msg`We were unable to submit this document at this time. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  const onDocumentRejected = (reason: string) => {
    if (window.parent) {
      window.parent.postMessage(
        {
          action: 'document-rejected',
          data: {
            token,
            documentId,
            recipientId: recipient.id,
            reason,
          },
        },
        '*',
      );
    }

    setHasRejectedDocument(true);
  };

  useLayoutEffect(() => {
    const hash = window.location.hash.slice(1);

    try {
      const data = ZSignDocumentEmbedDataSchema.parse(JSON.parse(decodeURIComponent(atob(hash))));

      if (!isCompleted && data.name) {
        setFullName(data.name);
      }

      // Since a recipient can be provided a name we can lock it without requiring
      // a to be provided by the parent application, unlike direct templates.
      setIsNameLocked(!!data.lockName);
      setAllowDocumentRejection(!!data.allowDocumentRejection);

      if (data.darkModeDisabled) {
        document.documentElement.classList.add('dark-mode-disabled');
      }

      if (isPlatformOrEnterprise) {
        injectCss({
          css: data.css,
          cssVars: data.cssVars,
        });
      }
    } catch (err) {
      console.error(err);
    }

    setHasFinishedInit(true);

    // !: While the two setters are stable we still want to ensure we're avoiding
    // !: re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasFinishedInit && hasDocumentLoaded && window.parent) {
      window.parent.postMessage(
        {
          action: 'document-ready',
          data: null,
        },
        '*',
      );
    }
  }, [hasFinishedInit, hasDocumentLoaded]);

  if (hasRejectedDocument) {
    return <EmbedDocumentRejected name={fullName} />;
  }

  if (hasCompletedDocument) {
    return (
      <EmbedDocumentCompleted
        name={fullName}
        signature={{
          id: 1,
          fieldId: 1,
          recipientId: 1,
          created: new Date(),
          signatureImageAsBase64: signature?.value?.startsWith('data:') ? signature.value : null,
          typedSignature: signature?.value?.startsWith('data:') ? null : (signature?.value ?? null),
          typedSignatureSettings:
            signature?.type === 'type'
              ? {
                  font: signature.font,
                  color: signature.color,
                }
              : null,
        }}
      />
    );
  }

  return (
    <RecipientProvider recipient={recipient} targetSigner={selectedSigner ?? null}>
      <div className="embed--Root relative mx-auto flex min-h-[100dvh] max-w-screen-lg flex-col items-center justify-center p-6">
        {(!hasFinishedInit || !hasDocumentLoaded) && <EmbedClientLoading />}

        {allowDocumentRejection && (
          <div className="embed--Actions mb-4 flex w-full flex-row-reverse items-baseline justify-between">
            <RejectDocumentDialog
              document={{ id: documentId }}
              token={token}
              onRejected={onDocumentRejected}
            />
          </div>
        )}

        <div className="embed--DocumentContainer relative flex w-full flex-col gap-x-6 gap-y-12 md:flex-row">
          {/* Viewer */}
          <div className="embed--DocumentViewer flex-1">
            <LazyPDFViewer
              documentData={documentData}
              onDocumentLoad={() => setHasDocumentLoaded(true)}
            />
          </div>

          {/* Widget */}
          <div
            key={isExpanded ? 'expanded' : 'collapsed'}
            className="embed--DocumentWidgetContainer group/document-widget fixed bottom-8 left-0 z-50 h-fit w-full flex-shrink-0 px-6 md:sticky md:top-4 md:z-auto md:w-[350px] md:px-0"
            data-expanded={isExpanded || undefined}
          >
            <div className="embed--DocumentWidget border-border bg-widget flex w-full flex-col rounded-xl border px-4 py-4 md:py-6">
              {/* Header */}
              <div className="embed--DocumentWidgetHeader">
                <div className="flex items-center justify-between gap-x-2">
                  <h3 className="text-foreground text-xl font-semibold md:text-2xl">
                    {isAssistantMode ? (
                      <Trans>Assist with signing</Trans>
                    ) : (
                      <Trans>Sign document</Trans>
                    )}
                  </h3>

                  <Button variant="outline" className="h-8 w-8 p-0 md:hidden">
                    {isExpanded ? (
                      <LucideChevronDown
                        className="text-muted-foreground h-5 w-5"
                        onClick={() => setIsExpanded(false)}
                      />
                    ) : (
                      <LucideChevronUp
                        className="text-muted-foreground h-5 w-5"
                        onClick={() => setIsExpanded(true)}
                      />
                    )}
                  </Button>
                </div>
              </div>

              <div className="embed--DocumentWidgetContent hidden group-data-[expanded]/document-widget:block md:block">
                <p className="text-muted-foreground mt-2 text-sm">
                  {isAssistantMode ? (
                    <Trans>Help complete the document for other signers.</Trans>
                  ) : (
                    <Trans>Sign the document to complete the process.</Trans>
                  )}
                </p>

                <hr className="border-border mb-8 mt-4" />
              </div>

              {/* Form */}
              <div className="embed--DocumentWidgetForm -mx-2 hidden px-2 group-data-[expanded]/document-widget:block md:block">
                <div className="flex flex-1 flex-col gap-y-4">
                  {isAssistantMode && (
                    <div>
                      <Label>
                        <Trans>Signing for</Trans>
                      </Label>

                      <fieldset className="dark:bg-background border-border mt-2 rounded-2xl border bg-white p-3">
                        <RadioGroup
                          className="gap-0 space-y-3 shadow-none"
                          value={selectedSignerId?.toString()}
                          onValueChange={(value) => setSelectedSignerId(Number(value))}
                        >
                          {allRecipients
                            .filter((r) => r.fields.length > 0)
                            .map((r) => (
                              <div
                                key={`${assistantSignersId}-${r.id}`}
                                className="bg-widget border-border relative flex flex-col gap-4 rounded-lg border p-4"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <RadioGroupItem
                                      id={`${assistantSignersId}-${r.id}`}
                                      value={r.id.toString()}
                                      className="after:absolute after:inset-0"
                                    />

                                    <div className="grid grow gap-1">
                                      <Label
                                        className="inline-flex items-start"
                                        htmlFor={`${assistantSignersId}-${r.id}`}
                                      >
                                        {r.name}

                                        {r.id === recipient.id && (
                                          <span className="text-muted-foreground ml-2">
                                            {_(msg`(You)`)}
                                          </span>
                                        )}
                                      </Label>
                                      <p className="text-muted-foreground text-xs">{r.email}</p>
                                    </div>
                                  </div>
                                  <div className="text-muted-foreground text-xs leading-[inherit]">
                                    {r.fields.length} {r.fields.length === 1 ? 'field' : 'fields'}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </RadioGroup>
                      </fieldset>
                    </div>
                  )}

                  {!isAssistantMode && (
                    <>
                      <div>
                        <Label htmlFor="full-name">
                          <Trans>Full Name</Trans>
                        </Label>

                        <Input
                          type="text"
                          id="full-name"
                          className="bg-background mt-2"
                          disabled={isNameLocked}
                          value={fullName}
                          onChange={(e) => !isNameLocked && setFullName(e.target.value)}
                        />
                      </div>

                      <div>
                        <Label htmlFor="email">
                          <Trans>Email</Trans>
                        </Label>

                        <Input
                          type="email"
                          id="email"
                          className="bg-background mt-2"
                          value={email}
                          disabled
                        />
                      </div>

                      <div>
                        <Label htmlFor="Signature">
                          <Trans>Signature</Trans>
                        </Label>

                        <Card className="mt-2" gradient degrees={-120}>
                          <CardContent className="p-0">
                            <SignaturePad
                              className="h-44 w-full"
                              disabled={isThrottled || isSubmitting}
                              value={signature ?? undefined}
                              onChange={(value) => {
                                setSignature(value);
                              }}
                              onValidityChange={(isValid) => {
                                setSignatureValid(isValid);
                              }}
                              typedSignatureEnabled={Boolean(
                                metadata &&
                                  'typedSignatureEnabled' in metadata &&
                                  metadata.typedSignatureEnabled,
                              )}
                            />
                          </CardContent>
                        </Card>

                        {hasSignatureField && !signatureValid && (
                          <div className="text-destructive mt-2 text-sm">
                            <Trans>
                              Signature is too small. Please provide a more complete signature.
                            </Trans>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="hidden flex-1 group-data-[expanded]/document-widget:block md:block" />

              <div className="embed--DocumentWidgetFooter mt-4 hidden w-full grid-cols-2 items-center group-data-[expanded]/document-widget:grid md:grid">
                {pendingFields.length > 0 ? (
                  <Button className="col-start-2" onClick={() => onNextFieldClick()}>
                    <Trans>Next</Trans>
                  </Button>
                ) : (
                  <Button
                    className={allowDocumentRejection ? 'col-start-2' : 'col-span-2'}
                    disabled={
                      isThrottled || (!isAssistantMode && hasSignatureField && !signatureValid)
                    }
                    loading={isSubmitting}
                    onClick={() => throttledOnCompleteClick()}
                  >
                    <Trans>Complete</Trans>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
            {showPendingFieldTooltip && pendingFields.length > 0 && (
              <FieldToolTip key={pendingFields[0].id} field={pendingFields[0]} color="warning">
                <Trans>Click to insert field</Trans>
              </FieldToolTip>
            )}
          </ElementVisible>

          {/* Fields */}
          <EmbedDocumentFields fields={fields} metadata={metadata} />
        </div>

        {!hidePoweredBy && (
          <div className="bg-primary text-primary-foreground fixed bottom-0 left-0 z-40 rounded-tr px-2 py-1 text-xs font-medium opacity-60 hover:opacity-100">
            <span>Powered by</span>
            <Logo className="ml-2 inline-block h-[14px]" />
          </div>
        )}
      </div>
    </RecipientProvider>
  );
};
