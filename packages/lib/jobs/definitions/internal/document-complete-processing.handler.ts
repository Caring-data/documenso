import { processDocumentCompletion } from '../../../server-only/document/complete-document-with-token';
import type { TDocumentCompleteProcessingJobDefinition } from './document-complete-processing';

export const run = async ({ payload }: { payload: TDocumentCompleteProcessingJobDefinition }) => {
  await processDocumentCompletion({
    documentId: payload.documentId,
    recipientId: payload.recipientId,
    requestMetadata: payload.requestMetadata,
  });
};
