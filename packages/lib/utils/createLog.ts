import { prisma } from '@documenso/prisma';

import type { ApiRequestMetadata, RequestMetadata } from '../universal/extract-request-metadata';

interface CreateLogParams {
  action: string;
  message?: string;
  data?: unknown;
  metadata?: RequestMetadata | ApiRequestMetadata;
  userId?: number | null;
}

export async function createLog({ action, message, data, metadata, userId }: CreateLogParams) {
  return await prisma.log.create({
    data: {
      action,
      message,
      data,
      metaData: metadata,
      userId,
    },
  });
}
