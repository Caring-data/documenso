import { createElement } from 'react';

import { msg } from '@lingui/macro';

import { ConfirmEmailTemplate } from '@documenso/email/templates/confirm-email';
import { sendEmail } from '@documenso/email/transports/notifyService';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n.server';
import { WEBAPP_BASE_URL } from '../../constants/app';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

export interface SendConfirmationEmailProps {
  userId: number;
}

export const sendConfirmationEmail = async ({ userId }: SendConfirmationEmailProps) => {
  // const NEXT_PRIVATE_SMTP_FROM_NAME = process.env.NEXT_PRIVATE_SMTP_FROM_NAME;
  // const NEXT_PRIVATE_SMTP_FROM_ADDRESS = process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS;

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    include: {
      verificationTokens: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const [verificationToken] = user.verificationTokens;

  if (!verificationToken?.token) {
    throw new Error('Verification token not found for the user');
  }

  const assetBaseUrl = WEBAPP_BASE_URL;
  const confirmationLink = `${assetBaseUrl}/verify-email/${verificationToken.token}`;
  // const senderName = NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso';
  // const senderAddress = NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com';

  const confirmationTemplate = createElement(ConfirmEmailTemplate, {
    assetBaseUrl,
    confirmationLink,
  });

  const [html] = await Promise.all([
    renderEmailWithI18N(confirmationTemplate),
    renderEmailWithI18N(confirmationTemplate, { plainText: true }),
  ]);

  const i18n = await getI18nInstance();

  // return mailer.sendMail({
  //   to: {
  //     address: user.email,
  //     name: user.name || '',
  //   },
  //   from: {
  //     name: senderName,
  //     address: senderAddress,
  //   },
  //   subject: i18n._(msg`Please confirm your email`),
  //   html,
  //   text,
  // });
  return await sendEmail(
    {
      name: user.name || '',
      email: user.email,
    },
    i18n._(msg`Please confirm your email`),
    html,
  );
};
