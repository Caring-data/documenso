import { createElement } from 'react';

import { msg } from '@lingui/macro';

import { DocumentPendingEmailTemplate } from '@documenso/email/templates/document-pending';
import { sendEmail } from '@documenso/email/transports/notifyService';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n.server';
import { WEBAPP_BASE_URL } from '../../constants/app';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../utils/team-global-settings-to-branding';

export interface SendPendingEmailOptions {
  documentId: number;
  recipientId: number;
}

export const sendPendingEmail = async ({ documentId, recipientId }: SendPendingEmailOptions) => {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      recipients: {
        some: {
          id: recipientId,
        },
      },
    },
    include: {
      recipients: {
        where: {
          id: recipientId,
        },
      },
      documentMeta: true,
      team: {
        include: {
          teamGlobalSettings: true,
        },
      },
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.recipients.length === 0) {
    throw new Error('Document has no recipients');
  }

  const isDocumentPendingEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).documentPending;

  if (!isDocumentPendingEmailEnabled) {
    return;
  }

  const [recipient] = document.recipients;

  const { email, name } = recipient;

  const assetBaseUrl = WEBAPP_BASE_URL;

  const template = createElement(DocumentPendingEmailTemplate, {
    documentName: document.title,
    assetBaseUrl,
    documentDetails: document.documentDetails || {},
    recipientName: recipient.name,
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

  const i18n = await getI18nInstance(document.documentMeta?.language);

  // await mailer.sendMail({
  //   to: {
  //     address: email,
  //     name,
  //   },
  //   from: {
  //     name: process.env.NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso',
  //     address: process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com',
  //   },
  //   subject: i18n._(msg`Waiting for others to complete signing.`),
  //   html,
  //   text,
  // });
  await sendEmail(
    {
      name,
      email: email ?? '',
    },
    i18n._(msg`Waiting for others to complete signing.`),
    html,
  );
};
