import bcrypt from 'bcryptjs';

import { prisma } from '@documenso/prisma';
import { UserSecurityAuditLogType } from '@documenso/prisma/client';

import { SALT_ROUNDS } from '../../constants/auth';
import { AppError, AppErrorCode } from '../../errors/app-error';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { sendResetPassword } from '../auth/send-reset-password';

export type ResetPasswordOptions = {
  token: string;
  password: string;
  requestMetadata?: RequestMetadata;
};

export const resetPassword = async ({ token, password, requestMetadata }: ResetPasswordOptions) => {
  if (!token) {
    throw new AppError('INVALID_TOKEN');
  }

  const foundToken = await prisma.passwordResetToken.findFirst({
    where: {
      token,
    },
    include: {
      user: true,
    },
  });

  if (!foundToken) {
    throw new AppError('INVALID_TOKEN');
  }

  const now = new Date();

  if (now > foundToken.expiry) {
    throw new AppError(AppErrorCode.EXPIRED_CODE);
  }

  const isSamePassword = await bcrypt.compareSync(password, foundToken.user.password || '');

  if (isSamePassword) {
    throw new AppError('SAME_PASSWORD');
  }

  const hashedPassword = await bcrypt.hashSync(password, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: foundToken.userId,
      },
      data: {
        password: hashedPassword,
      },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: foundToken.userId,
      },
    }),
    prisma.userSecurityAuditLog.create({
      data: {
        userId: foundToken.userId,
        type: UserSecurityAuditLogType.PASSWORD_RESET,
        userAgent: requestMetadata?.userAgent,
        ipAddress: requestMetadata?.ipAddress,
      },
    }),
  ]);

  await sendResetPassword({ userId: foundToken.userId });
};
