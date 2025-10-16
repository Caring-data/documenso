import { DateTime } from 'luxon';

import { kyselyPrisma, sql } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

export const getCompletedDocumentsMonthly = async (type: 'count' | 'cumulative' = 'count') => {
  const qb = kyselyPrisma.$kysely
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .selectFrom('Document' as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select(({ fn, ref }: any) => [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fn('DATE_TRUNC', [sql.lit('MONTH'), ref('updatedAt')]).as('month') as any,
      fn.count('id').as('count'),
      fn
        .sum(fn.count('id'))
        // Feels like a bug in the Kysely extension but I just can not do this orderBy in a type-safe manner
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
        .over((ob: any) =>
          ob.orderBy(fn('DATE_TRUNC', [sql.lit('MONTH'), ref('updatedAt')]) as any),
        )
        .as('cume_count'),
    ])
    .where(() => sql`"Document"."status" = ${DocumentStatus.COMPLETED}::"DocumentStatus"`)
    .groupBy('month')
    .orderBy('month', 'desc')
    .limit(12);

  const result = await qb.execute();

  const transformedData = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    labels: result
      .map((row: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) =>
        DateTime.fromJSDate(row.month).toFormat('MMM yyyy'),
      )
      .reverse(),
    datasets: [
      {
        label: type === 'count' ? 'Completed Documents per Month' : 'Total Completed Documents',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: result
          .map((row: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) =>
            type === 'count' ? Number(row.count) : Number(row.cume_count),
          )
          .reverse(),
      },
    ],
  };

  return transformedData;
};

export type GetCompletedDocumentsMonthlyResult = Awaited<
  ReturnType<typeof getCompletedDocumentsMonthly>
>;
