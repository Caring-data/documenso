import type { Document, Recipient } from '@documenso/prisma/client';

import type { TDocumentDetails } from '../../types/document';
import { createLog } from '../../utils/createLog';
import { generateLaravelToken } from './getLaravelToken';

export const storeSignedDocument = async (
  document: Document,
  base64Data: string,
  documentDetails: TDocumentDetails | undefined,
  documentId: number,
  recipient: Recipient,
  allSigned: boolean = false,
) => {
  try {
    const token = generateLaravelToken();

    const apiUrl = process.env.NEXT_PRIVATE_LARAVEL_API_URL;
    if (!apiUrl) throw new Error('Laravel API URL is not defined');

    const url = `${apiUrl}/external/store-signed-document`;

    const formData = {
      clientName: String(documentDetails?.companyName || ''),
      documensoId: String(documentId),
      documentKey: String(document.formKey || ''),
      residentId: String(document.residentId || ''),
      base64File: base64Data,
      recipient: allSigned ? 'AllRecipientsSigned' : recipient?.email,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-TOKEN': token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    const EXPECTED_SUCCESS_MESSAGE = 'Signed document stored successfully';

    if (!response.ok || data?.message !== EXPECTED_SUCCESS_MESSAGE) {
      throw new Error('Laravel rejected the request');
    }

    return { fileUrl: data.fileUrl };
  } catch (error) {
    console.error('Error storing signed document:', error);

    const response =
      typeof error === 'object' && error !== null && 'response' in error
        ? error?.response
        : undefined;

    await createLog({
      action: 'LARAVEL_STORE_SIGNED_DOCUMENT_ERROR',
      message: 'Error while storing signed document to Laravel',
      data: {
        documentId,
        recipientEmail: recipient?.email,
        error: error instanceof Error ? error.message : String(error),
        response,
      },
      userId: document.userId,
    });

    throw new Error('Could not store the signed document.');
  }
};
