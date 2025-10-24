import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export interface GetResidentInfoOptions {
  token: string;
}

export const getResidentInfo = async ({ token }: GetResidentInfoOptions) => {
  if (!token) {
    throw new Error('Missing token');
  }

  const result = await prisma.recipient.findFirst({
    where: { token },
    include: {
      document: {
        select: {
          residentId: true,
        },
      },
    },
  });

  if (!result) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Resident not found',
    });
  }

  if (!result.document?.residentId) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Resident ID not found',
    });
  }

  return {
    residentId: result.document.residentId,
  };
};
