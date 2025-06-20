import { createElement } from 'react';

import { msg } from '@lingui/macro';

import { DocumentInviteEmailTemplate } from '@documenso/email/templates/document-invite';
import { sendEmail } from '@documenso/email/transports/notifyService';
import {
  RECIPIENT_ROLES_DESCRIPTION,
  RECIPIENT_ROLE_TO_EMAIL_TYPE,
} from '@documenso/lib/constants/recipient-roles';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { renderCustomEmailTemplate } from '@documenso/lib/utils/render-custom-email-template';
import { prisma } from '@documenso/prisma';
import type { Prisma } from '@documenso/prisma/client';
import { DocumentStatus, RecipientRole, SigningStatus } from '@documenso/prisma/client';

import { getI18nInstance } from '../../client-only/providers/i18n.server';
import { NEXT_PUBLIC_WEBAPP_URL, WEBAPP_BASE_URL } from '../../constants/app';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import { createLog } from '../../utils/createLog';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../utils/team-global-settings-to-branding';
import { getDocumentWhereInput } from './get-document-by-id';

export type ResendDocumentOptions = {
  documentId: number;
  userId: number;
  recipients: number[];
  recipientEmail?: string;
  teamId?: number;
  requestMetadata: ApiRequestMetadata;
};

export const resendDocument = async ({
  documentId,
  userId,
  recipients,
  recipientEmail,
  teamId,
  requestMetadata,
}: ResendDocumentOptions): Promise<void> => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const documentWhereInput: Prisma.DocumentWhereUniqueInput = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findUnique({
    where: documentWhereInput,
    include: {
      recipients: {
        where: {
          AND: [
            recipientEmail
              ? { email: recipientEmail }
              : recipients
                ? { id: { in: recipients } }
                : {},
            { signingStatus: SigningStatus.NOT_SIGNED },
          ],
        },
      },
      documentMeta: true,
      team: {
        select: {
          teamEmail: true,
          name: true,
          teamGlobalSettings: true,
        },
      },
    },
  });

  const customEmail = document?.documentMeta;
  const isTeamDocument = document?.team !== null;

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.recipients.length === 0) {
    throw new Error('Document has no recipients');
  }

  if (document.status === DocumentStatus.DRAFT) {
    throw new Error('Can not send draft document');
  }

  if (document.status === DocumentStatus.COMPLETED) {
    throw new Error('Can not send completed document');
  }

  const isRecipientSigningRequestEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).recipientSigningRequest;

  if (!isRecipientSigningRequestEmailEnabled) {
    return;
  }

  try {
    await Promise.all(
      document.recipients.map(async (recipient) => {
        if (recipient.role === RecipientRole.CC) {
          return;
        }

        const i18n = await getI18nInstance(document.documentMeta?.language);

        const recipientEmailType = RECIPIENT_ROLE_TO_EMAIL_TYPE[recipient.role];

        const { email, name } = recipient;
        const selfSigner = email === user.email;

        const recipientActionVerb = i18n
          ._(RECIPIENT_ROLES_DESCRIPTION[recipient.role].actionVerb)
          .toLowerCase();

        let emailMessage = customEmail?.message || '';
        let emailSubject = i18n._(msg`Reminder: Please ${recipientActionVerb} this document`);

        if (selfSigner) {
          emailMessage = i18n._(
            msg`You have initiated the document ${`"${document.title}"`} that requires you to ${recipientActionVerb} it.`,
          );
          emailSubject = i18n._(msg`Reminder: Please ${recipientActionVerb} your document`);
        }

        if (isTeamDocument && document.team) {
          emailSubject = i18n._(
            msg`Reminder: ${document.team.name} invited you to ${recipientActionVerb} a document`,
          );
          emailMessage =
            customEmail?.message ||
            i18n._(
              msg`${user.name} on behalf of "${document.team.name}" has invited you to ${recipientActionVerb} the document "${document.title}".`,
            );
        }

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
          inviterEmail: isTeamDocument ? document.team?.teamEmail?.email || user.email : user.email,
          assetBaseUrl,
          signDocumentLink,
          customBody: renderCustomEmailTemplate(emailMessage, customEmailTemplate),
          role: recipient.role,
          selfSigner,
          isTeamInvite: isTeamDocument,
          teamName: document.team?.name,
          recipientName: recipient.name,
          documentDetails: document.documentDetails || {},
          tokenExpiration: recipient.expired ? recipient.expired.toISOString() : undefined,
        });

        const branding = document.team?.teamGlobalSettings
          ? teamGlobalSettingsToBranding(document.team.teamGlobalSettings)
          : undefined;

        await prisma.$transaction(
          async (tx) => {
            const [html] = await Promise.all([
              renderEmailWithI18N(template, {
                lang: document.documentMeta?.language,
                branding,
              }),
              renderEmailWithI18N(template, {
                lang: document.documentMeta?.language,
                branding,
                plainText: true,
              }),
            ]);

            // await mailer.sendMail({
            //   to: {
            //     address: email,
            //     name,
            //   },
            //   from: {
            //     name: FROM_NAME,
            //     address: FROM_ADDRESS,
            //   },
            //   subject: customEmail?.subject
            //     ? renderCustomEmailTemplate(
            //         i18n._(msg`Reminder: ${customEmail.subject}`),
            //         customEmailTemplate,
            //       )
            //     : emailSubject,
            //   html,
            //   text,
            // });

            await sendEmail(
              {
                name,
                email: email ?? '',
              },
              customEmail?.subject
                ? renderCustomEmailTemplate(
                    i18n._(msg`Reminder: ${customEmail.subject}`),
                    customEmailTemplate,
                  )
                : emailSubject,
              html,
            );

            await tx.documentAuditLog.create({
              data: createDocumentAuditLogData({
                type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
                documentId: document.id,
                metadata: requestMetadata,
                data: {
                  emailType: recipientEmailType,
                  recipientEmail: recipient.email ?? '',
                  recipientName: recipient.name,
                  recipientRole: recipient.role,
                  recipientId: recipient.id,
                  isResending: true,
                },
              }),
            });
          },
          { timeout: 30_000 },
        );
      }),
    );
  } catch (error) {
    await createLog({
      action: 'RESEND_DOCUMENT_ERROR',
      message: 'Error while resending document invitation',
      data: {
        documentId,
        recipientEmail: recipientEmail ?? null,
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      metadata: requestMetadata,
      userId,
    });

    throw error;
  }
};
