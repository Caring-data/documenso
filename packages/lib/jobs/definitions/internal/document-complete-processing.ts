import { z } from 'zod';

import { ZRequestMetadataSchema } from '../../../universal/extract-request-metadata';
import { type JobDefinition } from '../../client/_internal/job';

const DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_ID = 'document.complete.processing';

const DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_SCHEMA = z.object({
  documentId: z.number(),
  recipientId: z.number(),
  requestMetadata: ZRequestMetadataSchema.optional(),
});

export type TDocumentCompleteProcessingJobDefinition = z.infer<
  typeof DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_SCHEMA
>;

export const DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION = {
  id: DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_ID,
  name: 'Document Complete Processing',
  version: '1.0.0',
  trigger: {
    name: DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_ID,
    schema: DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload }) => {
    const handler = await import('./document-complete-processing.handler');

    await handler.run({ payload });
  },
} as const satisfies JobDefinition<
  typeof DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_ID,
  TDocumentCompleteProcessingJobDefinition
>;
