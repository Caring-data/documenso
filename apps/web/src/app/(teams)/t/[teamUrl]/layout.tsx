import React from 'react';

import { RedirectType, redirect } from 'next/navigation';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { getTeams } from '@documenso/lib/server-only/team/get-teams';
import { SubscriptionStatus } from '@documenso/prisma/client';
import { TrpcProvider } from '@documenso/trpc/react';

import { Header } from '~/components/(dashboard)/layout/header';
import { RefreshOnFocus } from '~/components/(dashboard)/refresh-on-focus/refresh-on-focus';
import { NextAuthProvider } from '~/providers/next-auth';
import { TeamProvider } from '~/providers/team';

import { LayoutBillingBanner } from './layout-billing-banner';

export type AuthenticatedTeamsLayoutProps = {
  children: React.ReactNode;
  params: {
    teamUrl: string;
  };
};

export default async function AuthenticatedTeamsLayout({
  children,
  params,
}: AuthenticatedTeamsLayoutProps) {
  await setupI18nSSR();

  const { session, user } = await getServerComponentSession();

  if (!session || !user) {
    redirect('/signin');
  }

  const [getTeamsPromise, getTeamPromise] = await Promise.allSettled([
    getTeams({ userId: user.id }),
    getTeamByUrl({ userId: user.id, teamUrl: params.teamUrl }),
  ]);

  if (getTeamPromise.status === 'rejected') {
    redirect('/documents', RedirectType.replace);
  }

  const team = getTeamPromise.value;
  const teams = getTeamsPromise.status === 'fulfilled' ? getTeamsPromise.value : [];

  const trpcHeaders = {
    'x-team-Id': team.id.toString(),
  };

  return (
    <NextAuthProvider session={session}>
      {team.subscription && team.subscription.status !== SubscriptionStatus.ACTIVE && (
        <LayoutBillingBanner
          subscription={team.subscription}
          teamId={team.id}
          userRole={team.currentTeamMember.role}
        />
      )}

      <Header user={user} teams={teams} />

      <TeamProvider team={team}>
        <TrpcProvider headers={trpcHeaders}>
          <main className="mt-8 pb-8 md:mt-12 md:pb-12">{children}</main>
        </TrpcProvider>
      </TeamProvider>

      <RefreshOnFocus />
    </NextAuthProvider>
  );
}
