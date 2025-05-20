import { useState } from 'react';

import { Trans } from '@lingui/macro';

import { cn } from '@documenso/ui/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@documenso/ui/primitives/select';

import { SignaturePadColorPicker } from './signature-pad-color-picker';

export type SignaturePadTypeProps = {
  className?: string;
  value?: string;
  onChange: (_value: { value: string; font: string; color: string }) => void;
};

export const SignaturePadType = ({ className, value, onChange }: SignaturePadTypeProps) => {
  const [selectedColor, setSelectedColor] = useState('black');
  const [selectedFont, setSelectedFont] = useState('Dancing Script');

  return (
    <div
      className={cn(
        'flex h-full min-h-40 w-full items-center justify-center sm:min-h-48',
        className,
      )}
    >
      <input
        data-testid="signature-pad-type-input"
        placeholder="Type your signature"
        style={{ color: selectedColor, fontFamily: selectedFont }}
        className="font-signature w-full bg-transparent px-4 text-center text-4xl text-black placeholder:text-4xl focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-white"
        value={value}
        onChange={(event) =>
          onChange({
            value: event.target.value.trimStart(),
            font: selectedFont,
            color: selectedColor,
          })
        }
      />

      <div className="dark:bg-background absolute left-2 top-2 bg-neutral-50">
        <Select value={selectedFont} onValueChange={(value) => setSelectedFont(value)}>
          <SelectTrigger className="h-auto w-auto border-none p-0.5">
            <p className="text-foreground px-2 text-sm">
              <Trans>Choose font</Trans>
            </p>
          </SelectTrigger>

          <SelectContent className="w-[150px]" align="start">
            {['Dancing Script', 'Great Vibes', 'Cookie', 'Monte Carlo', 'Lato'].map((font) => (
              <SelectItem key={font} value={font}>
                <span style={{ fontFamily: font }} className="text-md">
                  {value ? value : font}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SignaturePadColorPicker selectedColor={selectedColor} setSelectedColor={setSelectedColor} />
    </div>
  );
};
