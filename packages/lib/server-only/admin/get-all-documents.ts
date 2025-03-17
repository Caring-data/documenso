import { prisma } from '@documenso/prisma';
import { EntityStatus, type Prisma } from '@documenso/prisma/client';

import type { FindResultResponse } from '../../types/search-params';

export interface FindDocumentsOptions {
  query?: string;
  page?: number;
  perPage?: number;
}

export const findDocuments = async ({ query, page = 1, perPage = 10 }: FindDocumentsOptions) => {
  const termFilters: Prisma.DocumentWhereInput | undefined = !query
    ? undefined
    : {
        title: {
          contains: query,
          mode: 'insensitive',
        },
      };

  const baseFilters: Prisma.DocumentWhereInput = {
    activityStatus: EntityStatus.ACTIVE,
    deletedAt: null,
    ...termFilters,
  };

  const [data, count] = await Promise.all([
    prisma.document.findMany({
      where: baseFilters,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recipients: true,
      },
    }),
    prisma.document.count({
      where: baseFilters,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
