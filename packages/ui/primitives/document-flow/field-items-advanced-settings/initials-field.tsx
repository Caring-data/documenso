import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { validateFields as validateInitialsFields } from '@documenso/lib/advanced-fields-validation/validate-fields';
import { type TInitialsFieldMeta as InitialsFieldMeta } from '@documenso/lib/types/field-meta';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Switch } from '@documenso/ui/primitives/switch';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../select';

type InitialsFieldAdvancedSettingsProps = {
  fieldState: InitialsFieldMeta;
  handleFieldChange: (key: keyof InitialsFieldMeta, value: string | boolean) => void;
  handleErrors: (errors: string[]) => void;
};

export const InitialsFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
  handleErrors,
}: InitialsFieldAdvancedSettingsProps) => {
  const { _ } = useLingui();

  const handleInput = (field: keyof InitialsFieldMeta, value: string | boolean) => {
    const fontSize = field === 'fontSize' ? Number(value) : Number(fieldState.fontSize ?? 14);
    const required = field === 'required' ? Boolean(value) : Boolean(fieldState.required);

    const errors = validateInitialsFields({
      fontSize,
      required,
      type: 'initials',
    });

    handleErrors(errors);
    handleFieldChange(field, value);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>
          <Trans>Font Size</Trans>
        </Label>
        <Input
          id="fontSize"
          type="number"
          className="bg-background mt-2"
          placeholder={_(msg`Field font size`)}
          value={fieldState.fontSize}
          onChange={(e) => handleInput('fontSize', e.target.value)}
          min={8}
          max={96}
        />
      </div>

      <div>
        <Label>
          <Trans>Text Align</Trans>
        </Label>

        <Select
          value={fieldState.textAlign}
          onValueChange={(value) => handleInput('textAlign', value)}
        >
          <SelectTrigger className="bg-background mt-2">
            <SelectValue placeholder="Select text align" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.required}
            onCheckedChange={(checked) => handleInput('required', checked)}
          />
          <Label>
            <Trans>Required field</Trans>
          </Label>
        </div>
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.readOnly}
            onCheckedChange={(checked) => handleInput('readOnly', checked)}
          />
          <Label>
            <Trans>Read only</Trans>
          </Label>
        </div>
      </div>
    </div>
  );
};
