import { createElement } from 'react';

import DocumentInviteEmailTemplate from '@documenso/email/templates/document-invite';
import { sendEmail } from '@documenso/email/transports/notifyService';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, RecipientRole, SendStatus } from '@documenso/prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL, WEBAPP_BASE_URL } from '../../../constants/app';
import { RECIPIENT_ROLE_TO_EMAIL_TYPE } from '../../../constants/recipient-roles';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { renderCustomEmailTemplate } from '../../../utils/render-custom-email-template';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../../utils/team-global-settings-to-branding';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendSigningEmailJobDefinition } from './send-signing-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendSigningEmailJobDefinition;
  io: JobRunIO;
}) => {
  const { userId, documentId, recipientId, requestMetadata } = payload;

  const [user, document, recipient] = await Promise.all([
    prisma.user.findFirstOrThrow({
      where: {
        id: userId,
      },
    }),
    prisma.document.findFirstOrThrow({
      where: {
        id: documentId,
        status: DocumentStatus.PENDING,
      },
      include: {
        documentMeta: true,
        team: {
          select: {
            teamEmail: true,
            name: true,
            teamGlobalSettings: true,
          },
        },
      },
    }),
    prisma.recipient.findFirstOrThrow({
      where: {
        id: recipientId,
      },
    }),
  ]);

  const { documentMeta, team } = document;

  if (recipient.role === RecipientRole.CC) {
    return;
  }

  const isRecipientSigningRequestEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).recipientSigningRequest;

  if (!isRecipientSigningRequestEmailEnabled) {
    return;
  }

  const customEmail = document?.documentMeta;
  const isTeamDocument = document.teamId !== null;

  const recipientEmailType = RECIPIENT_ROLE_TO_EMAIL_TYPE[recipient.role];

  const { email, name } = recipient;
  const selfSigner = email === user.email;

  const emailMessage = customEmail?.message || '';

  const customEmailTemplate = {
    'signer.name': name,
    'signer.email': email ?? '',
    'document.name': document.title,
  };

  const assetBaseUrl = WEBAPP_BASE_URL;
  const signDocumentLink = `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`;

  const template = createElement(DocumentInviteEmailTemplate, {
    documentName: document.title,
    inviterName: user.name || undefined,
    inviterEmail: isTeamDocument ? team?.teamEmail?.email || user.email : user.email,
    assetBaseUrl,
    signDocumentLink,
    customBody: renderCustomEmailTemplate(emailMessage, customEmailTemplate),
    role: recipient.role,
    selfSigner,
    isTeamInvite: isTeamDocument,
    teamName: team?.name,
    teamEmail: team?.teamEmail?.email,
    includeSenderDetails: team?.teamGlobalSettings?.includeSenderDetails,
    recipientName: recipient.name,
    documentDetails: document.documentDetails || {},
    tokenExpiration: recipient.expired ? recipient.expired.toISOString() : undefined,
  });

  await io.runTask('send-signing-email', async () => {
    const branding = document.team?.teamGlobalSettings
      ? teamGlobalSettingsToBranding(document.team.teamGlobalSettings)
      : undefined;

    const [html] = await Promise.all([
      renderEmailWithI18N(template, { lang: documentMeta?.language, branding }),
      renderEmailWithI18N(template, {
        lang: documentMeta?.language,
        branding,
        plainText: true,
      }),
    ]);

    // await mailer.sendMail({
    //   to: {
    //     name: recipient.name,
    //     address: recipient.email,
    //   },
    //   from: {
    //     name: FROM_NAME,
    //     address: FROM_ADDRESS,
    //   },
    //   subject: renderCustomEmailTemplate(
    //     documentMeta?.subject || emailSubject,
    //     customEmailTemplate,
    //   ),
    //   html,
    //   text,
    // });
    await sendEmail(
      {
        name: recipient.name,
        email: recipient.email ?? '',
      },
      renderCustomEmailTemplate(documentMeta?.subject || '', customEmailTemplate),
      html,
    );
  });

  await io.runTask('update-recipient', async () => {
    await prisma.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        sendStatus: SendStatus.SENT,
      },
    });
  });

  await io.runTask('store-audit-log', async () => {
    await prisma.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
        documentId: document.id,
        user,
        requestMetadata,
        data: {
          emailType: recipientEmailType,
          recipientId: recipient.id,
          recipientName: recipient.name,
          recipientEmail: recipient.email ?? '',
          recipientRole: recipient.role,
          isResending: false,
        },
      }),
    });
  });
};
