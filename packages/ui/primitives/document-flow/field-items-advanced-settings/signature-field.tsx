import { Trans } from '@lingui/macro';

import { type TSignatureFieldMeta as SignatureFieldMeta } from '@documenso/lib/types/field-meta';
import { Label } from '@documenso/ui/primitives/label';
import { Switch } from '@documenso/ui/primitives/switch';

type Props = {
  fieldState: SignatureFieldMeta;
  handleFieldChange: (key: keyof SignatureFieldMeta, value: string | boolean) => void;
  handleErrors: (errors: string[]) => void;
};

export const SignatureFieldAdvancedSettings = ({ fieldState, handleFieldChange }: Props) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Switch
          className="bg-background"
          checked={fieldState.required ?? false}
          onCheckedChange={(value) => handleFieldChange('required', Boolean(value))}
        />
        <Label>
          <Trans>Required field</Trans>
        </Label>
      </div>
    </div>
  );
};
