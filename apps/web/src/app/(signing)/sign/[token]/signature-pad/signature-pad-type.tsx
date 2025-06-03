import { useEffect, useRef, useState } from 'react';

import { Trans } from '@lingui/macro';

import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { cn } from '@documenso/ui/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@documenso/ui/primitives/select';

import type { SignaturePadValue } from './signature-pad';
import { SignaturePadColorPicker } from './signature-pad-color-picker';

export type SignaturePadTypeProps = {
  className?: string;
  value?: SignaturePadValue;
  onChange: (_value: SignaturePadValue) => void;
};

export const SignaturePadType = ({ className, value, onChange }: SignaturePadTypeProps) => {
  const [selectedFont, setSelectedFont] = useState(value?.font || 'Dancing Script');
  const [selectedColor, setSelectedColor] = useState(value?.color || 'black');
  const [fontSize, setFontSize] = useState(40);
  console.log('type', value);
  const editableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editableRef.current || !value?.value) return;

    const parentWidth = editableRef.current.parentElement?.clientWidth || 300;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let newFontSize = 40;
    ctx.font = `${newFontSize}px ${selectedFont}`;
    let textWidth = ctx.measureText(value.value).width;

    while (textWidth > parentWidth * 0.9 && newFontSize > 12) {
      newFontSize -= 1;
      ctx.font = `${newFontSize}px ${selectedFont}`;
      textWidth = ctx.measureText(value.value).width;
    }

    setFontSize(newFontSize);
  }, [value?.value, selectedFont]);

  const handleInput = () => {
    const text = editableRef.current?.textContent || '';

    onChange({
      type: DocumentSignatureType.TYPE,
      value: text,
      font: selectedFont,
      color: selectedColor,
    });
  };

  useEffect(() => {
    if (editableRef.current && value && value.value !== editableRef.current.textContent) {
      editableRef.current.textContent = value.value;
    }
  }, [value]);

  useEffect(() => {
    if (value?.font) setSelectedFont(value.font);
    if (value?.color) setSelectedColor(value.color);
  }, [value?.font, value?.color]);

  return (
    <div
      className={cn(
        'relative flex h-full min-h-40 w-full items-center justify-center sm:min-h-48',
        className,
      )}
    >
      <div
        className={cn(
          'relative flex h-full min-h-40 w-full items-center justify-center sm:min-h-48',
          className,
        )}
      >
        {(!value?.value || value.value.length === 0) && (
          <span
            className="text-muted-foreground pointer-events-none absolute left-4 right-4 text-center text-4xl opacity-50"
            style={{
              fontFamily: selectedFont,
              fontSize: `${fontSize}px`,
              color: selectedColor,
              opacity: 0.3,
            }}
          >
            Type your signature
          </span>
        )}

        <div
          ref={editableRef}
          contentEditable
          suppressContentEditableWarning
          style={{
            color: selectedColor,
            fontFamily: selectedFont,
            fontSize: `${fontSize}px`,
          }}
          className="font-signature w-full px-4 text-center text-black focus:outline-none dark:text-white"
          onInput={handleInput}
        />
      </div>

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
                  {value?.value || font}
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
