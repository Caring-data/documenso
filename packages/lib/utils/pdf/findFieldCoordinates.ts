import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

import type { Field, Recipient } from '@documenso/prisma/client';

interface PDFTextPosition {
  x: number;
  y: number;
  page: number;
}

export async function findFieldCoordinatesFromPdf({
  base64Pdf,
  fieldName,
}: {
  base64Pdf: string;
  fieldName: string;
}): Promise<PDFTextPosition | null> {
  const base64 = base64Pdf.replace(/^data:application\/pdf;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const uint8Array = new Uint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
  const pdf = await loadingTask.promise;

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    for (const item of content.items) {
      if ('str' in item && item.str.includes(`{{${fieldName}}}`)) {
        const x = item.transform[4];
        const y = viewport.height - item.transform[5];

        const percentX = (x / viewport.width) * 100;
        const percentY = (y / viewport.height) * 100;

        const verticalOffset = 0.4;
        const adjustedY = percentY - verticalOffset;

        return {
          x: Number(percentX.toFixed(4)),
          y: Number(adjustedY.toFixed(4)),
          page: pageIndex + 1,
        };
      }
    }
  }

  console.warn('⚠️ Field not found:', fieldName);
  return null;
}

export function getFieldVariableName(recipient: Recipient, field: Field): string {
  const base = `signature${recipient.signingOrder || recipient.id}`;
  if (field.type === 'SIGNATURE') return base;
  if (field.type === 'TEXT') return `${base}-text`;
  if (field.type === 'DATE') return `${base}-date`;
  return base;
}
