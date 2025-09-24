import { prisma } from '@documenso/prisma';
import { EntityStatus } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';

export interface GetTemplateByExternalIdOptions {
  externalId: string;
}

export const getTemplateByExternalId = async ({ externalId }: GetTemplateByExternalIdOptions) => {
  const template = await prisma.template.findFirstOrThrow({
    where: {
      externalId,
      activityStatus: { not: EntityStatus.INACTIVE },
      deletedAt: null,
    },
    include: {
      directLink: true,
      templateDocumentData: true,
      templateMeta: true,
      recipients: true,
      fields: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  return template;
};
