import { createElement } from 'react';

import { ResetPasswordTemplate } from '@documenso/email/templates/reset-password';
import { sendEmail } from '@documenso/email/transports/notifyService';
import { prisma } from '@documenso/prisma';

import { WEBAPP_BASE_URL } from '../../constants/app';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

export interface SendResetPasswordOptions {
  userId: number;
}

export const sendResetPassword = async ({ userId }: SendResetPasswordOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const assetBaseUrl = WEBAPP_BASE_URL;

  const template = createElement(ResetPasswordTemplate, {
    assetBaseUrl,
    userEmail: user.email,
    userName: user.name || '',
  });

  const [html] = await Promise.all([
    renderEmailWithI18N(template),
    renderEmailWithI18N(template, { plainText: true }),
  ]);

  // return await mailer.sendMail({
  //   to: {
  //     address: user.email,
  //     name: user.name || '',
  //   },
  //   from: {
  //     name: process.env.NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso',
  //     address: process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com',
  //   },
  //   subject: 'Password Reset Success!',
  //   html,
  //   text,
  // });

  return await sendEmail(
    {
      name: user.name || '',
      email: user.email,
    },
    'Password Reset Success!',
    html,
  );
};
