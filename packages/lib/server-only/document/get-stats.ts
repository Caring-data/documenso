import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

import type { PeriodSelectorValue } from '@documenso/lib/server-only/document/find-documents';
import { prisma } from '@documenso/prisma';
import { EntityStatus, TeamMemberRole } from '@documenso/prisma/client';
import type { Prisma, User } from '@documenso/prisma/client';
import { SigningStatus } from '@documenso/prisma/client';
import { DocumentVisibility } from '@documenso/prisma/client';
import { isExtendedDocumentStatus } from '@documenso/prisma/guards/is-extended-document-status';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

export type GetStatsInput = {
  user: User;
  team?: Omit<GetTeamCountsOption, 'createdAt'>;
  period?: PeriodSelectorValue;
  search?: string;
};

export const getStats = async ({ user, period, search, ...options }: GetStatsInput) => {
  let createdAt: Prisma.DocumentWhereInput['createdAt'];

  if (period) {
    const daysAgo = parseInt(period.replace(/d$/, ''), 10);

    const startOfPeriod = DateTime.now().minus({ days: daysAgo }).startOf('day');

    createdAt = {
      gte: startOfPeriod.toJSDate(),
    };
  }

  const [ownerCounts, notSignedCounts, hasSignedCounts] = await (options.team
    ? getTeamCounts({
        ...options.team,
        createdAt,
        currentUserEmail: user.email,
        userId: user.id,
        search,
      })
    : getCounts({ user, createdAt, search }));

  const stats: Record<ExtendedDocumentStatus, number> = {
    [ExtendedDocumentStatus.DRAFT]: 0,
    [ExtendedDocumentStatus.PENDING]: 0,
    [ExtendedDocumentStatus.COMPLETED]: 0,
    [ExtendedDocumentStatus.INBOX]: 0,
    [ExtendedDocumentStatus.ALL]: 0,
  };

  ownerCounts.forEach((stat) => {
    stats[stat.status] = stat._count._all;
  });

  notSignedCounts.forEach((stat) => {
    stats[ExtendedDocumentStatus.INBOX] += stat._count._all;
  });

  hasSignedCounts.forEach((stat) => {
    if (stat.status === ExtendedDocumentStatus.COMPLETED) {
      stats[ExtendedDocumentStatus.COMPLETED] += stat._count._all;
    }

    if (stat.status === ExtendedDocumentStatus.PENDING) {
      stats[ExtendedDocumentStatus.PENDING] += stat._count._all;
    }
  });

  Object.keys(stats).forEach((key) => {
    if (key !== ExtendedDocumentStatus.ALL && isExtendedDocumentStatus(key)) {
      stats[ExtendedDocumentStatus.ALL] += stats[key];
    }
  });

  return stats;
};

type GetCountsOption = {
  user: User;
  createdAt: Prisma.DocumentWhereInput['createdAt'];
  search?: string;
};

const getCounts = async ({ user, createdAt, search }: GetCountsOption) => {
  const searchFilter: Prisma.DocumentWhereInput = {
    OR: [
      { title: { contains: search, mode: 'insensitive' } },
      { recipients: { some: { name: { contains: search, mode: 'insensitive' } } } },
      { recipients: { some: { email: { contains: search, mode: 'insensitive' } } } },
    ],
  };

  return Promise.all([
    // Owner counts.
    prisma.document.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
        userId: user.id,
        createdAt,
        teamId: null,
        activityStatus: EntityStatus.ACTIVE,
        deletedAt: null,
        AND: [searchFilter],
      },
    }),
    // Not signed counts.
    prisma.document.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
        status: ExtendedDocumentStatus.PENDING,
        recipients: {
          some: {
            email: user.email,
            signingStatus: SigningStatus.NOT_SIGNED,
            documentDeletedAt: null,
          },
        },
        createdAt,
        activityStatus: EntityStatus.ACTIVE,
        deletedAt: null,
        AND: [searchFilter],
      },
    }),
    // Has signed counts.
    prisma.document.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
        createdAt,
        user: {
          email: {
            not: user.email,
          },
        },
        OR: [
          {
            status: ExtendedDocumentStatus.PENDING,
            recipients: {
              some: {
                email: user.email,
                signingStatus: SigningStatus.SIGNED,
                documentDeletedAt: null,
              },
            },
          },
          {
            status: ExtendedDocumentStatus.COMPLETED,
            recipients: {
              some: {
                email: user.email,
                signingStatus: SigningStatus.SIGNED,
                documentDeletedAt: null,
              },
            },
          },
        ],
        activityStatus: EntityStatus.ACTIVE,
        deletedAt: null,
        AND: [searchFilter],
      },
    }),
  ]);
};

type GetTeamCountsOption = {
  teamId: number;
  teamEmail?: string;
  senderIds?: number[];
  currentUserEmail: string;
  userId: number;
  createdAt: Prisma.DocumentWhereInput['createdAt'];
  currentTeamMemberRole?: TeamMemberRole;
  search?: string;
};

const getTeamCounts = async (options: GetTeamCountsOption) => {
  const { createdAt, teamId, teamEmail } = options;

  const senderIds = options.senderIds ?? [];

  const userIdWhereClause: Prisma.DocumentWhereInput['userId'] =
    senderIds.length > 0
      ? {
          in: senderIds,
        }
      : undefined;

  const searchFilter: Prisma.DocumentWhereInput = {
    OR: [
      { title: { contains: options.search, mode: 'insensitive' } },
      { recipients: { some: { name: { contains: options.search, mode: 'insensitive' } } } },
      { recipients: { some: { email: { contains: options.search, mode: 'insensitive' } } } },
    ],
  };

  let ownerCountsWhereInput: Prisma.DocumentWhereInput = {
    userId: userIdWhereClause,
    createdAt,
    teamId,
    deletedAt: null,
  };

  let notSignedCountsGroupByArgs = null;
  let hasSignedCountsGroupByArgs = null;

  const visibilityFiltersWhereInput: Prisma.DocumentWhereInput = {
    AND: [
      { deletedAt: null },
      {
        OR: [
          match(options.currentTeamMemberRole)
            .with(TeamMemberRole.ADMIN, () => ({
              visibility: {
                in: [
                  DocumentVisibility.EVERYONE,
                  DocumentVisibility.MANAGER_AND_ABOVE,
                  DocumentVisibility.ADMIN,
                ],
              },
            }))
            .with(TeamMemberRole.MANAGER, () => ({
              visibility: {
                in: [DocumentVisibility.EVERYONE, DocumentVisibility.MANAGER_AND_ABOVE],
              },
            }))
            .otherwise(() => ({
              visibility: {
                equals: DocumentVisibility.EVERYONE,
              },
            })),
          {
            OR: [
              { userId: options.userId },
              { recipients: { some: { email: options.currentUserEmail } } },
            ],
          },
        ],
      },
    ],
  };

  ownerCountsWhereInput = {
    ...ownerCountsWhereInput,
    ...visibilityFiltersWhereInput,
    ...searchFilter,
  };

  if (teamEmail) {
    ownerCountsWhereInput = {
      userId: userIdWhereClause,
      createdAt,
      OR: [
        {
          teamId,
        },
        {
          user: {
            email: teamEmail,
          },
        },
      ],
      deletedAt: null,
    };

    notSignedCountsGroupByArgs = {
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
        userId: userIdWhereClause,
        createdAt,
        status: ExtendedDocumentStatus.PENDING,
        recipients: {
          some: {
            email: teamEmail,
            signingStatus: SigningStatus.NOT_SIGNED,
            documentDeletedAt: null,
          },
        },
        deletedAt: null,
      },
    } satisfies Prisma.DocumentGroupByArgs;

    hasSignedCountsGroupByArgs = {
      by: ['status'],
      _count: {
        _all: true,
      },
      where: {
        userId: userIdWhereClause,
        createdAt,
        OR: [
          {
            status: ExtendedDocumentStatus.PENDING,
            recipients: {
              some: {
                email: teamEmail,
                signingStatus: SigningStatus.SIGNED,
                documentDeletedAt: null,
              },
            },
            deletedAt: null,
          },
          {
            status: ExtendedDocumentStatus.COMPLETED,
            recipients: {
              some: {
                email: teamEmail,
                signingStatus: SigningStatus.SIGNED,
                documentDeletedAt: null,
              },
            },
            deletedAt: null,
          },
        ],
      },
    } satisfies Prisma.DocumentGroupByArgs;
  }

  return Promise.all([
    prisma.document.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
      where: ownerCountsWhereInput,
    }),
    notSignedCountsGroupByArgs ? prisma.document.groupBy(notSignedCountsGroupByArgs) : [],
    hasSignedCountsGroupByArgs ? prisma.document.groupBy(hasSignedCountsGroupByArgs) : [],
  ]);
};
