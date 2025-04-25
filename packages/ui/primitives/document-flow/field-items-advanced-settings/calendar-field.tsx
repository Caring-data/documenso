import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { validateCalendarField } from '@documenso/lib/advanced-fields-validation/validate-calendar';
import { type TDateFieldMeta as CalendarFieldMeta } from '@documenso/lib/types/field-meta';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Switch } from '@documenso/ui/primitives/switch';

type CalendarFieldAdvancedSettingsProps = {
  fieldState: CalendarFieldMeta;
  handleFieldChange: (key: keyof CalendarFieldMeta, value: string | boolean) => void;
  handleErrors: (errors: string[]) => void;
};

export const CalendarFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
  handleErrors,
}: CalendarFieldAdvancedSettingsProps) => {
  const { _ } = useLingui();

  const handleInput = (field: keyof CalendarFieldMeta, value: string | boolean) => {
    const fontSize = field === 'fontSize' ? Number(value) : Number(fieldState.fontSize ?? 14);
    const readOnly = field === 'readOnly' ? Boolean(value) : Boolean(fieldState.readOnly);
    const required = field === 'required' ? Boolean(value) : Boolean(fieldState.required);

    const errors = validateCalendarField({
      fontSize,
      readOnly,
      required,
      type: 'calendar',
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
      </div>
    </div>
  );
};
