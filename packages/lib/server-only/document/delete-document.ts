'use server';

import { createElement } from 'react';

import { msg } from '@lingui/macro';

import DocumentCancelTemplate from '@documenso/email/templates/document-cancel';
import { sendEmail } from '@documenso/email/transports/notifyService';
import { prisma } from '@documenso/prisma';
import type {
  Document,
  DocumentMeta,
  Recipient,
  Team,
  TeamGlobalSettings,
  User,
} from '@documenso/prisma/client';
import { EntityStatus, SendStatus, WebhookTriggerEvents } from '@documenso/prisma/client';

import { getI18nInstance } from '../../client-only/providers/i18n.server';
import { WEBAPP_BASE_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../utils/team-global-settings-to-branding';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type DeleteDocumentOptions = {
  id: number;
  userId: number;
  teamId?: number;
  requestMetadata: ApiRequestMetadata;
};

export const deleteDocument = async ({
  id,
  userId,
  teamId,
  requestMetadata,
}: DeleteDocumentOptions) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User not found',
    });
  }

  const document = await prisma.document.findUnique({
    where: {
      id,
    },
    include: {
      recipients: true,
      documentMeta: true,
      team: {
        include: {
          members: true,
          teamGlobalSettings: true,
        },
      },
    },
  });

  if (!document || (teamId !== undefined && teamId !== document.teamId)) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const isUserOwner = document.userId === userId;
  const isUserTeamMember = document.team?.members.some((member) => member.userId === userId);
  const userRecipient = document.recipients.find((recipient) => recipient.email === user.email);

  if (!isUserOwner && !isUserTeamMember && !userRecipient) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Not allowed',
    });
  }

  // Handle hard or soft deleting the actual document if user has permission.
  if (isUserOwner || isUserTeamMember) {
    await handleDocumentOwnerDelete({
      document,
      user,
      team: document.team,
      requestMetadata,
    });
  }

  // Continue to hide the document from the user if they are a recipient.
  // Dirty way of doing this but it's faster than refetching the document.
  if (userRecipient?.documentDeletedAt === null) {
    await prisma.recipient
      .update({
        where: {
          id: userRecipient.id,
        },
        data: {
          documentDeletedAt: new Date().toISOString(),
        },
      })
      .catch(() => {
        // Do nothing.
      });
  }

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_CANCELLED,
    data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(document)),
    userId,
    teamId,
  });

  // Return partial document for API v1 response.
  return {
    id: document.id,
    userId: document.userId,
    teamId: document.teamId,
    title: document.title,
    status: document.status,
    documentDataId: document.documentDataId,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    completedAt: document.completedAt,
  };
};

type HandleDocumentOwnerDeleteOptions = {
  document: Document & {
    recipients: Recipient[];
    documentMeta: DocumentMeta | null;
  };
  team?:
    | (Team & {
        teamGlobalSettings?: TeamGlobalSettings | null;
      })
    | null;
  user: User;
  requestMetadata: ApiRequestMetadata;
};

const handleDocumentOwnerDelete = async ({
  document,
  user,
  team,
  requestMetadata,
}: HandleDocumentOwnerDeleteOptions) => {
  if (document.deletedAt) {
    return;
  }

  // Soft delete completed documents.
  const softDeletedDocument = await prisma.$transaction(async (tx) => {
    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        documentId: document.id,
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED,
        metadata: requestMetadata,
        data: {
          type: 'SOFT',
        },
      }),
    });

    return await tx.document.update({
      where: {
        id: document.id,
      },
      data: {
        deletedAt: new Date().toISOString(),
        activityStatus: EntityStatus.INACTIVE,
      },
    });
  });

  const isDocumentDeleteEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).documentDeleted;

  if (!isDocumentDeleteEmailEnabled) {
    return softDeletedDocument;
  }

  // Send cancellation emails to recipients.
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

      const branding = team?.teamGlobalSettings
        ? teamGlobalSettingsToBranding(team.teamGlobalSettings)
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

  return softDeletedDocument;
};
