import { DateTime } from 'luxon';

import { kyselyPrisma, sql } from '@documenso/prisma';

export const getSignerConversionMonthly = async (type: 'count' | 'cumulative' = 'count') => {
  const qb = (
    kyselyPrisma.$kysely
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .selectFrom('Recipient' as any) as any
  )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .innerJoin('User' as any, 'Recipient.email' as any, 'User.email' as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select(({ fn, ref }: any) => [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fn('DATE_TRUNC', [sql.lit('MONTH'), ref('User.createdAt')]).as('month') as any,
      fn.count(ref('Recipient.email')).distinct().as('count'),
      fn
        .sum(fn.count(ref('Recipient.email')).distinct())
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
        .over((ob: any) =>
          ob.orderBy(fn('DATE_TRUNC', [sql.lit('MONTH'), ref('User.createdAt')]) as any),
        )
        .as('cume_count'),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where('Recipient.signedAt' as any, 'is not', null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where('Recipient.signedAt' as any, '<', (eb: any) => eb.ref('User.createdAt'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .groupBy(({ fn, ref }: any) => fn('DATE_TRUNC', [sql.lit('MONTH'), ref('User.createdAt')]))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .orderBy('month' as any, 'desc');

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
        label: type === 'count' ? 'Signers That Signed Up' : 'Total Signers That Signed Up',
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

export type GetSignerConversionMonthlyResult = Awaited<
  ReturnType<typeof getSignerConversionMonthly>
>;
