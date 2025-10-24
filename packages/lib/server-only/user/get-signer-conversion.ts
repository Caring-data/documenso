import { DateTime } from 'luxon';

import { kyselyPrisma, sql } from '@documenso/prisma';

export const getSignerConversionMonthly = async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qb = (kyselyPrisma.$kysely as any)
    .selectFrom('Recipient')
    .innerJoin('User', 'Recipient.email', 'User.email')
    .select(({ fn }: any) => [
      fn('DATE_TRUNC', [sql.lit('MONTH'), 'User.createdAt']).as('month'),
      fn.count('Recipient.email').distinct().as('count'),
      fn
        .sum(fn.count('Recipient.email').distinct())
        .over((ob: any) => ob.orderBy(fn('DATE_TRUNC', [sql.lit('MONTH'), 'User.createdAt'])))
        .as('cume_count'),
    ])
    .where('Recipient.signedAt', 'is not', null)
    .where('Recipient.signedAt', '<', (eb: any) => eb.ref('User.createdAt'))
    .groupBy(({ fn }: any) => fn('DATE_TRUNC', [sql.lit('MONTH'), 'User.createdAt']))
    .orderBy('month', 'desc');

  const result = await qb.execute();

  return result.map((row: { month: Date; count: string; cume_count: string }) => ({
    month: DateTime.fromJSDate(row.month).toFormat('yyyy-MM'),
    count: Number(row.count),
    cume_count: Number(row.cume_count),
  }));
};

export type GetSignerConversionMonthlyResult = Awaited<
  ReturnType<typeof getSignerConversionMonthly>
>;
