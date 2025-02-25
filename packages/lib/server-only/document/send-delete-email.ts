import { createElement } from 'react';

import { msg } from '@lingui/macro';

import { DocumentSuperDeleteEmailTemplate } from '@documenso/email/templates/document-super-delete';
import { sendEmail } from '@documenso/email/transports/notifyService';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n.server';
import { WEBAPP_BASE_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../utils/team-global-settings-to-branding';

export interface SendDeleteEmailOptions {
  documentId: number;
  reason: string;
}

export const sendDeleteEmail = async ({ documentId, reason }: SendDeleteEmailOptions) => {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
    },
    include: {
      user: true,
      documentMeta: true,
      team: {
        include: {
          teamGlobalSettings: true,
        },
      },
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const isDocumentDeletedEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).documentDeleted;

  if (!isDocumentDeletedEmailEnabled) {
    return;
  }

  const { email, name } = document.user;

  const assetBaseUrl = WEBAPP_BASE_URL;

  const template = createElement(DocumentSuperDeleteEmailTemplate, {
    documentName: document.title,
    reason,
    assetBaseUrl,
  });

  const branding = document.team?.teamGlobalSettings
    ? teamGlobalSettingsToBranding(document.team.teamGlobalSettings)
    : undefined;

  const [html] = await Promise.all([
    renderEmailWithI18N(template, { lang: document.documentMeta?.language, branding }),
    renderEmailWithI18N(template, {
      lang: document.documentMeta?.language,
      branding,
      plainText: true,
    }),
  ]);

  const i18n = await getI18nInstance();

  // await mailer.sendMail({
  //   to: {
  //     address: email,
  //     name: name || '',
  //   },
  //   from: {
  //     name: process.env.NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso',
  //     address: process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com',
  //   },
  //   subject: i18n._(msg`Document Deleted!`),
  //   html,
  //   text,
  // });
  await sendEmail(
    {
      name: name || '',
      email: email,
    },
    i18n._(msg`Document Deleted!`),
    html,
  );
};
