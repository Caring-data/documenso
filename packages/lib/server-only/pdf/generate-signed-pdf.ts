import { PDFDocument } from 'pdf-lib';

import type { Document, Field } from '@documenso/prisma/client';
import { signPdf } from '@documenso/signing';

import { compressPdfBuffer } from './compressPdf';
import { flattenAnnotations } from './flatten-annotations';
import { flattenForm } from './flatten-form';
import { insertFieldInPDF } from './insert-field-in-pdf';
import { normalizeSignatureAppearances } from './normalize-signature-appearances';

export const generateSignedPdf = async ({
  document,
  fields,
  certificateData,
}: {
  document: Document & {
    documentData: {
      data: Buffer | string;
    };
  };
  fields: Field[];
  certificateData?: Buffer | null;
}): Promise<Buffer> => {
  const dataBuffer = Buffer.isBuffer(document.documentData.data)
    ? document.documentData.data
    : Buffer.from(document.documentData.data, 'base64');

  const pdfDoc = await PDFDocument.load(new Uint8Array(dataBuffer));

  normalizeSignatureAppearances(pdfDoc);
  flattenForm(pdfDoc);
  flattenAnnotations(pdfDoc);

  if (certificateData) {
    const certificateDoc = await PDFDocument.load(new Uint8Array(certificateData));
    const certificatePages = await pdfDoc.copyPages(
      certificateDoc,
      certificateDoc.getPageIndices(),
    );
    certificatePages.forEach((page) => pdfDoc.addPage(page));
  }

  for (const field of fields) {
    if (field.inserted) {
      await insertFieldInPDF(pdfDoc, field);
    }
  }

  flattenForm(pdfDoc);

  const signedPdfBytes = await pdfDoc.save();
  const signedPdf = await signPdf({ pdf: Buffer.from(signedPdfBytes) });

  const compressedPdf = await compressPdfBuffer(signedPdf, 'medium');

  return compressedPdf;
};
