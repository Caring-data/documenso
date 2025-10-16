import { DateTime } from 'luxon';

import { kyselyPrisma, sql } from '@documenso/prisma';

export const getUserMonthlyGrowth = async (type: 'count' | 'cumulative' = 'count') => {
  const qb = (kyselyPrisma.$kysely as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .selectFrom('User' as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select(({ fn, ref }: any) => [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fn('DATE_TRUNC', [sql.lit('MONTH'), ref('createdAt')]).as('month') as any,
      fn.count('id').as('count'),
      fn
        .sum(fn.count('id'))
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
        .over((ob: any) =>
          ob.orderBy(fn('DATE_TRUNC', [sql.lit('MONTH'), ref('createdAt')]) as any),
        )
        .as('cume_count'),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .groupBy('month' as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .orderBy('month' as any, 'desc')
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
        label: type === 'count' ? 'New Users' : 'Total Users',
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

export type GetUserMonthlyGrowthResult = Awaited<ReturnType<typeof getUserMonthlyGrowth>>;
