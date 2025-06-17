import type { Document, Recipient } from '@documenso/prisma/client';

import { fetchWithLaravelAuth } from '../../laravel-auth/fetch-with-laravel-auth';
import type { TDocumentDetails } from '../../types/document';
import { createLog } from '../../utils/createLog';
import { getLaravelToken } from './getLaravelToken';

export const storeSignedDocument = async (
  document: Document,
  base64Data: string,
  documentDetails: TDocumentDetails | undefined,
  documentId: number,
  recipient: Recipient,
  allSigned: boolean = false,
) => {
  try {
    const laravelToken = await getLaravelToken();

    const formData = {
      clientName: String(documentDetails?.companyName || ''),
      documensoId: String(documentId),
      documentKey: String(document.formKey || ''),
      residentId: String(document.residentId || ''),
      base64File: base64Data,
      recipient: allSigned ? 'AllRecipientsSigned' : recipient?.email,
    };

    const apiUrl = process.env.NEXT_PRIVATE_LARAVEL_API_URL;
    const url = `${apiUrl}/residents/electronic-signature/store-signed-document`;

    if (!apiUrl) {
      throw new Error('Environment variables for the Laravel API are not defined.');
    }

    const response = await fetchWithLaravelAuth(
      url,
      {
        method: 'POST',
        body: JSON.stringify(formData),
      },
      laravelToken,
    );

    if (
      !response ||
      typeof response !== 'object' ||
      response.message !== 'Signed document stored successfully'
    ) {
      console.error('Laravel API did not return expected success message:', response);
      throw new Error('Could not store the signed document.');
    }

    const { fileUrl } = response;

    return { fileUrl };
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
