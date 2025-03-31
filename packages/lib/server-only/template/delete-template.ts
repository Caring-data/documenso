'use server';

import { prisma } from '@documenso/prisma';
import { EntityStatus } from '@documenso/prisma/client';

export type DeleteTemplateOptions = {
  id: number;
  userId: number;
  teamId?: number;
};

export const deleteTemplate = async ({ id, userId, teamId }: DeleteTemplateOptions) => {
  return await prisma.template.update({
    where: {
      id,
      ...(teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          }),
    },
    data: {
      deletedAt: new Date(),
      activityStatus: EntityStatus.INACTIVE,
    },
  });
};
