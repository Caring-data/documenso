import { createElement } from 'react';

import { msg } from '@lingui/macro';

import { TeamEmailRemovedTemplate } from '@documenso/email/templates/team-email-removed';
import { sendEmail } from '@documenso/email/transports/notifyService';
import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n.server';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../utils/team-global-settings-to-branding';

export type DeleteTeamEmailOptions = {
  userId: number;
  userEmail: string;
  teamId: number;
};

/**
 * Delete a team email.
 *
 * The user must either be part of the team with the required permissions, or the owner of the email.
 */
export const deleteTeamEmail = async ({ userId, userEmail, teamId }: DeleteTeamEmailOptions) => {
  const team = await prisma.$transaction(async (tx) => {
    const foundTeam = await tx.team.findFirstOrThrow({
      where: {
        id: teamId,
        OR: [
          {
            teamEmail: {
              email: userEmail,
            },
          },
          {
            members: {
              some: {
                userId,
                role: {
                  in: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
                },
              },
            },
          },
        ],
      },
      include: {
        teamEmail: true,
        owner: {
          select: {
            name: true,
            email: true,
          },
        },
        teamGlobalSettings: true,
      },
    });

    await tx.teamEmail.delete({
      where: {
        teamId,
      },
    });

    return foundTeam;
  });

  try {
    const assetBaseUrl = WEBAPP_BASE_URL;

    const template = createElement(TeamEmailRemovedTemplate, {
      assetBaseUrl,
      baseUrl: WEBAPP_BASE_URL,
      teamEmail: team.teamEmail?.email ?? '',
      teamName: team.name,
      teamUrl: team.url,
    });

    const branding = team.teamGlobalSettings
      ? teamGlobalSettingsToBranding(team.teamGlobalSettings)
      : undefined;

    const lang = team.teamGlobalSettings?.documentLanguage;

    const [html] = await Promise.all([
      renderEmailWithI18N(template, { lang, branding }),
      renderEmailWithI18N(template, { lang, branding, plainText: true }),
    ]);

    const i18n = await getI18nInstance(lang);

    // await mailer.sendMail({
    //   to: {
    //     address: team.owner.email,
    //     name: team.owner.name ?? '',
    //   },
    //   from: {
    //     name: FROM_NAME,
    //     address: FROM_ADDRESS,
    //   },
    //   subject: i18n._(msg`Team email has been revoked for ${team.name}`),
    //   html,
    //   text,
    // });
    await sendEmail(
      {
        name: team.owner.name ?? '',
        email: team.owner.email,
      },
      i18n._(msg`Team email has been revoked for ${team.name}`),
      html,
    );
  } catch (e) {
    // Todo: Teams - Alert us.
    // We don't want to prevent a user from revoking access because an email could not be sent.
  }
};
