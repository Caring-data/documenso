'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZTextFieldMeta } from '@documenso/lib/types/field-meta';
import { FieldType } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useRequiredDocumentAuthContext } from './document-auth-provider';
import { useRecipientContext } from './recipient-context';
import { SigningFieldContainer } from './signing-field-container';

export type LocationFieldProps = {
  field: FieldWithSignature;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
  residentInfo?: Record<string, unknown>;
};

// Helper function to get field label based on location field type
const getLocationFieldLabel = (fieldType: FieldType): string => {
  switch (fieldType) {
    case FieldType.RESIDENT_LOCATION_NAME:
      return 'Location Name';
    case FieldType.RESIDENT_LOCATION_STATE:
      return 'State';
    case FieldType.RESIDENT_LOCATION_ADDRESS:
      return 'Address';
    case FieldType.RESIDENT_LOCATION_CITY:
      return 'City';
    case FieldType.RESIDENT_LOCATION_ZIP_CODE:
      return 'ZIP Code';
    case FieldType.RESIDENT_LOCATION_COUNTRY:
      return 'Country';
    case FieldType.RESIDENT_LOCATION_FAX:
      return 'Facility Fax';

    case FieldType.RESIDENT_LOCATION_LICENSING:
      return 'Licensing Number';
    case FieldType.RESIDENT_LOCATION_LICENSING_NAME:
      return "Licensee's Name";
    case FieldType.RESIDENT_LOCATION_ADMINISTRATOR_NAME:
      return 'Facility Administrator';
    case FieldType.RESIDENT_LOCATION_ADMINISTRATOR_PHONE:
      return 'Administrator Phone Number';
    default:
      return 'Location Information';
  }
};

// Helper function to extract the correct value from location info
const getLocationValue = (fieldType: FieldType, residentInfo?: Record<string, unknown>): string => {
  if (!residentInfo || typeof residentInfo.location !== 'object' || !residentInfo.location) {
    return '';
  }

  const location = residentInfo.location as Record<string, unknown>;

  switch (fieldType) {
    case FieldType.RESIDENT_LOCATION_NAME:
      return typeof location.name === 'string' ? location.name : '';
    case FieldType.RESIDENT_LOCATION_STATE:
      return typeof location.state === 'string' ? location.state : '';
    case FieldType.RESIDENT_LOCATION_ADDRESS:
      return typeof location.address === 'string' ? location.address : '';
    case FieldType.RESIDENT_LOCATION_CITY:
      return typeof location.city === 'string' ? location.city : '';
    case FieldType.RESIDENT_LOCATION_ZIP_CODE:
      return typeof location.zip === 'string' ? location.zip : '';
    case FieldType.RESIDENT_LOCATION_COUNTRY:
      return typeof location.country === 'string' ? location.country : '';
    case FieldType.RESIDENT_LOCATION_FAX:
      return typeof location.location_fax === 'string' ? location.location_fax : '';
    case FieldType.RESIDENT_LOCATION_LICENSING:
      return typeof location.licensing === 'string' ? location.licensing : '';
    case FieldType.RESIDENT_LOCATION_LICENSING_NAME:
      return typeof location.licensing_name === 'string' ? location.licensing_name : '';
    case FieldType.RESIDENT_LOCATION_ADMINISTRATOR_NAME:
      return typeof location.admin === 'string' ? location.admin : '';
    case FieldType.RESIDENT_LOCATION_ADMINISTRATOR_PHONE:
      return typeof location.phone_lic === 'string' ? location.phone_lic : '';
    default:
      return '';
  }
};

export const LocationField = ({
  field,
  onSignField,
  onUnsignField,
  residentInfo,
}: LocationFieldProps) => {
  const router = useRouter();

  const { _ } = useLingui();
  const { toast } = useToast();

  const { recipient, isAssistantMode } = useRecipientContext();

  const { executeActionAuthProcedure } = useRequiredDocumentAuthContext();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isPending: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  // Parse field meta - location fields use text field meta
  const safeFieldMeta = ZTextFieldMeta.safeParse(field.fieldMeta);
  const parsedFieldMeta = safeFieldMeta.success ? safeFieldMeta.data : null;

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [localValue, setLocalValue] = useState('');

  const fieldLabel = getLocationFieldLabel(field.type);
  const locationValue = getLocationValue(field.type, residentInfo);

  const onPreSign = () => {
    // If we have location info, auto-fill and proceed
    if (locationValue && !isAssistantMode) {
      return true;
    }

    // If no location info and not assistant mode, show modal
    if (!locationValue && !isAssistantMode) {
      setShowLocationModal(true);
      return false;
    }

    return true;
  };

  /**
   * When the user clicks the sign button in the dialog where they enter the location value.
   */
  const onDialogSignClick = () => {
    setShowLocationModal(false);

    void executeActionAuthProcedure({
      onReauthFormSubmit: async (authOptions) => await onSign(authOptions, localValue),
      actionTarget: field.type,
    });
  };

  const onSign = async (authOptions?: TRecipientActionAuth, value?: string) => {
    try {
      // Priority: provided value > location value > local value
      const fieldValue = value || locationValue || localValue || '';

      if (!fieldValue && !isAssistantMode) {
        setShowLocationModal(true);
        return;
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value: fieldValue,
        isBase64: false,
        authOptions,
      };

      if (onSignField) {
        await onSignField(payload);
        return;
      }

      await signFieldWithToken(payload);

      startTransition(() => router.refresh());
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

      console.error(err);

      toast({
        title: _(msg`Error`),
        description: isAssistantMode
          ? _(msg`An error occurred while signing as assistant.`)
          : _(msg`An error occurred while signing the document.`),
        variant: 'destructive',
      });
    }
  };

  const onRemove = async () => {
    try {
      const payload: TRemovedSignedFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
      };

      if (onUnsignField) {
        await onUnsignField(payload);
        return;
      }

      await removeSignedFieldWithToken(payload);

      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while removing the field.`),
        variant: 'destructive',
      });
    }
  };

  return (
    <SigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onRemove}
      type="Location"
    >
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <p className="group-hover:text-primary text-muted-foreground flex items-center justify-center text-[0.5rem] duration-200 group-hover:text-yellow-300 sm:text-xs md:text-sm">
          <Trans>{fieldLabel}</Trans>
        </p>
      )}

      {field.inserted && (
        <div className="flex h-full w-full items-center">
          <p
            className={cn(
              'text-muted-foreground dark:text-background/80 w-full text-[clamp(0.425rem,25cqw,0.825rem)] duration-200',
              {
                'text-left': parsedFieldMeta?.textAlign === 'left',
                'text-center':
                  !parsedFieldMeta?.textAlign || parsedFieldMeta?.textAlign === 'center',
                'text-right': parsedFieldMeta?.textAlign === 'right',
              },
            )}
          >
            {field.customText}
          </p>
        </div>
      )}

      <Dialog open={showLocationModal} onOpenChange={setShowLocationModal}>
        <DialogContent>
          <DialogTitle>
            <Trans>
              Sign as
              <div>
                {recipient.name} <div className="text-muted-foreground">({recipient.email})</div>
              </div>
            </Trans>
          </DialogTitle>

          <div>
            <Label htmlFor="location-field">
              <Trans>{fieldLabel}</Trans>
            </Label>

            <Input
              id="location-field"
              type="text"
              className="mt-2"
              value={localValue}
              placeholder={`Enter ${fieldLabel.toLowerCase()}`}
              onChange={(e) => setLocalValue(e.target.value.trimStart())}
            />
          </div>

          <DialogFooter>
            <div className="flex w-full flex-1 flex-nowrap gap-4">
              <Button
                type="button"
                className="dark:bg-muted dark:hover:bg-muted/80 flex-1 bg-black/5 hover:bg-black/10"
                variant="secondary"
                onClick={() => {
                  setShowLocationModal(false);
                  setLocalValue('');
                }}
              >
                <Trans>Cancel</Trans>
              </Button>

              <Button
                type="button"
                className="flex-1"
                disabled={!localValue}
                onClick={() => onDialogSignClick()}
              >
                <Trans>Sign</Trans>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SigningFieldContainer>
  );
};
