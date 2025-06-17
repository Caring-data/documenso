import type { HTMLAttributes } from 'react';
import { useEffect, useState } from 'react';

import { KeyboardIcon, UploadCloudIcon } from 'lucide-react';
import { match } from 'ts-pattern';

import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { isBase64Image } from '@documenso/lib/constants/signatures';
import { SignatureIcon } from '@documenso/ui/icons/signature';
import { cn } from '@documenso/ui/lib/utils';

import { SignaturePadDraw } from './signature-pad-draw';
import { SignaturePadType } from './signature-pad-type';
import { SignaturePadUpload } from './signature-pad-upload';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './signature-tabs';

export type SignaturePadValue = {
  type: DocumentSignatureType;
  value: string;
  font?: string;
  color?: string;
};

export type SignaturePadProps = Omit<HTMLAttributes<HTMLCanvasElement>, 'onChange'> & {
  value?: SignaturePadValue;
  onChange?: (_value: SignaturePadValue) => void;
  className?: string;
  disabled?: boolean;

  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;

  onValidityChange?: (isValid: boolean) => void;
};

export const SignaturePad = ({
  value,
  className = '',
  onChange,
  disabled = false,
  typedSignatureEnabled = true,
  uploadSignatureEnabled = true,
  drawSignatureEnabled = true,
}: SignaturePadProps) => {
  const [imageSignature, setImageSignature] = useState(
    value?.type === DocumentSignatureType.UPLOAD && isBase64Image(value?.value) ? value.value : '',
  );

  const [drawSignature, setDrawSignature] = useState(
    value?.type === DocumentSignatureType.DRAW && isBase64Image(value?.value) ? value.value : '',
  );

  const [typedSignature, setTypedSignature] = useState<SignaturePadValue>({
    type: DocumentSignatureType.TYPE,
    value:
      value?.type === DocumentSignatureType.TYPE && !isBase64Image(value.value) ? value.value : '',
    font: value?.font || 'Dancing Script',
    color: value?.color || 'black',
  });

  useEffect(() => {
    if (!value) return;

    switch (value.type) {
      case DocumentSignatureType.DRAW:
        setDrawSignature(value.value);
        break;
      case DocumentSignatureType.UPLOAD:
        setImageSignature(value.value);
        break;
      case DocumentSignatureType.TYPE:
        setTypedSignature({
          ...value,
        });
        break;
    }
  }, [value]);

  /**
   * This is cooked.
   *
   * Get the first enabled tab that has a signature if possible, otherwise just get
   * the first enabled tab.
   */
  const [tab, setTab] = useState<'draw' | 'text' | 'image'>(() => {
    // First passthrough to check to see if there's a signature for a given tab.
    if (value?.type === DocumentSignatureType.DRAW && drawSignatureEnabled) return 'draw';
    if (value?.type === DocumentSignatureType.UPLOAD && uploadSignatureEnabled) return 'image';
    if (value?.type === DocumentSignatureType.TYPE && typedSignatureEnabled) return 'text';

    // Second passthrough to just select the first avaliable tab.
    if (drawSignatureEnabled) return 'draw';
    if (typedSignatureEnabled) return 'text';
    if (uploadSignatureEnabled) return 'image';

    throw new Error('No signature enabled');
  });

  const onImageSignatureChange = (value: string) => {
    setImageSignature(value);

    onChange?.({
      type: DocumentSignatureType.UPLOAD,
      value,
    });
  };

  const onDrawSignatureChange = (value: string) => {
    setDrawSignature(value);

    onChange?.({
      type: DocumentSignatureType.DRAW,
      value,
    });
  };

  const onTypedSignatureChange = (signature: SignaturePadValue) => {
    setTypedSignature(signature);
    onChange?.(signature);
  };

  const onTabChange = (selectedTab: 'draw' | 'text' | 'image') => {
    if (disabled) return;

    setTab(selectedTab);

    match(selectedTab)
      .with('draw', () => {
        setTypedSignature({
          type: DocumentSignatureType.TYPE,
          value: '',
          font: 'Dancing Script',
          color: 'black',
        });
        setImageSignature('');
        onDrawSignatureChange(drawSignature);
      })
      .with('text', () => {
        setDrawSignature('');
        setImageSignature('');
        onTypedSignatureChange(typedSignature);
      })
      .with('image', () => {
        setTypedSignature({
          type: DocumentSignatureType.TYPE,
          value: '',
          font: 'Dancing Script',
          color: 'black',
        });
        setDrawSignature('');
        onImageSignatureChange(imageSignature);
      })
      .exhaustive();
  };

  if (!drawSignatureEnabled && !typedSignatureEnabled && !uploadSignatureEnabled) {
    return null;
  }

  return (
    <Tabs
      defaultValue={tab}
      className={cn(className, {
        'pointer-events-none': disabled,
      })}
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      onValueChange={(value) => onTabChange(value as 'draw' | 'text' | 'image')}
    >
      <TabsList>
        {drawSignatureEnabled && (
          <TabsTrigger value="draw">
            <SignatureIcon className="mr-2 size-4" />
            Draw
          </TabsTrigger>
        )}

        {typedSignatureEnabled && (
          <TabsTrigger value="text">
            <KeyboardIcon className="mr-2 size-4" />
            Type
          </TabsTrigger>
        )}

        {uploadSignatureEnabled && (
          <TabsTrigger value="image">
            <UploadCloudIcon className="mr-2 size-4" />
            Upload
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent
        value="draw"
        className="border-border aspect-signature-pad dark:bg-background relative flex items-center justify-center rounded-md border bg-neutral-50 text-center"
      >
        <SignaturePadDraw
          className="h-full min-h-40 w-full sm:min-h-48"
          onChange={onDrawSignatureChange}
          value={drawSignature}
        />
      </TabsContent>

      <TabsContent
        value="text"
        className="border-border aspect-signature-pad dark:bg-background relative flex items-center justify-center rounded-md border bg-neutral-50 text-center"
      >
        <SignaturePadType value={typedSignature} onChange={onTypedSignatureChange} />
      </TabsContent>

      <TabsContent
        value="image"
        className={cn(
          'border-border aspect-signature-pad dark:bg-background relative rounded-md border bg-neutral-50',
          {
            'bg-white': imageSignature,
          },
        )}
      >
        <SignaturePadUpload value={imageSignature} onChange={onImageSignatureChange} />
      </TabsContent>
    </Tabs>
  );
};
