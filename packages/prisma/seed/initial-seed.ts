import bcrypt from 'bcryptjs';
import { env } from 'next-runtime-env';

import { prisma } from '..';
import { Role, TeamMemberRole } from '../client';

export const seedDatabase = async () => {
  const userName = env('USER_NAME');
  const email = env('USER_EMAIL') || 'admin@documenso.com';
  const password = env('USER_PASSWORD') || 'defaultPassword';
  const hashedPassword = bcrypt.hashSync(password, 10);

  let adminUser = await prisma.user.findUnique({
    where: { email },
  });

  if (adminUser) {
    console.log(`[SEEDING]: Administrator user already exists: ${email}`);
  } else {
    adminUser = await prisma.user.create({
      data: {
        name: userName,
        email,
        emailVerified: new Date(),
        password: hashedPassword,
        roles: [Role.USER, Role.ADMIN],
      },
    });
    console.log(`[SEEDING]: Administrator user created: ${email}`);
  }

  let team = await prisma.team.findUnique({
    where: { url: 'caring-data' },
  });

  if (team) {
    console.log(`[SEEDING]: The team already exists: ${team.name}`);
  } else {
    team = await prisma.team.create({
      data: {
        name: 'Caring Data',
        url: 'caring-data',
        ownerUserId: adminUser.id,
      },
    });
    console.log(`[SEEDING]: Team created: ${team.name}`);
  }

  const teamMember = await prisma.teamMember.findFirst({
    where: {
      teamId: team.id,
      userId: adminUser.id,
    },
  });

  if (teamMember) {
    console.log(`[SEEDING]: The TeamMember relationship already exists.`);
  } else {
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: adminUser.id,
        role: TeamMemberRole.ADMIN,
      },
    });
    console.log(`[SEEDING]: TeamMember relationship created.`);
  }
};
