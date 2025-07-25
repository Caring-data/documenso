'use server';

import { createElement } from 'react';

import { msg } from '@lingui/macro';

import DocumentCancelTemplate from '@documenso/email/templates/document-cancel';
import { sendEmail } from '@documenso/email/transports/notifyService';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, SendStatus } from '@documenso/prisma/client';

import { getI18nInstance } from '../../client-only/providers/i18n.server';
import { WEBAPP_BASE_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../utils/team-global-settings-to-branding';

export type SuperDeleteDocumentOptions = {
  id: number;
  requestMetadata?: RequestMetadata;
};

export const superDeleteDocument = async ({ id, requestMetadata }: SuperDeleteDocumentOptions) => {
  const document = await prisma.document.findUnique({
    where: {
      id,
    },
    include: {
      recipients: true,
      documentMeta: true,
      user: true,
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

  const { status, user } = document;

  const isDocumentDeletedEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).documentDeleted;

  // if the document is pending, send cancellation emails to all recipients
  if (
    status === DocumentStatus.PENDING &&
    document.recipients.length > 0 &&
    isDocumentDeletedEmailEnabled
  ) {
    await Promise.all(
      document.recipients.map(async (recipient) => {
        if (recipient.sendStatus !== SendStatus.SENT) {
          return;
        }

        const assetBaseUrl = WEBAPP_BASE_URL;
        const template = createElement(DocumentCancelTemplate, {
          documentName: document.title,
          inviterName: user.name || undefined,
          inviterEmail: user.email,
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

        const i18n = await getI18nInstance(document.documentMeta?.language);

        // await mailer.sendMail({
        //   to: {
        //     address: recipient.email,
        //     name: recipient.name,
        //   },
        //   from: {
        //     name: FROM_NAME,
        //     address: FROM_ADDRESS,
        //   },
        //   subject: i18n._(msg`Document Cancelled`),
        //   html,
        //   text,
        // });
        await sendEmail(
          {
            name: recipient.name,
            email: recipient.email ?? '',
          },
          i18n._(msg`Document Cancelled`),
          html,
        );
      }),
    );
  }

  // always hard delete if deleted from admin
  return await prisma.$transaction(async (tx) => {
    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        documentId: id,
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED,
        user,
        requestMetadata,
        data: {
          type: 'HARD',
        },
      }),
    });

    return await tx.document.delete({ where: { id } });
  });
};
