import bcrypt from 'bcrypt';
import { env } from 'next-runtime-env';

import { prisma } from '..';
import { Role, TeamMemberRole } from '../client';

export const seedDatabase = async () => {
  const userName = env('USER_NAME');
  const email = env('USER_EMAIL') || 'admin@documenso.com';
  const password = env('USER_PASSWORD') || 'defaultPassword';
  const hashedPassword = bcrypt.hashSync(password, 10);

  const adminUser = await prisma.user.upsert({
    where: {
      email,
    },
    create: {
      name: userName,
      email,
      emailVerified: new Date(),
      password: hashedPassword,
      roles: [Role.USER, Role.ADMIN],
    },
    update: {},
  });

  const team = await prisma.team.create({
    data: {
      name: 'Caring Data',
      url: 'caring-data',
      ownerUserId: adminUser.id,
    },
  });

  await prisma.teamMember.create({
    data: {
      teamId: team.id,
      userId: adminUser.id,
      role: TeamMemberRole.ADMIN,
    },
  });
};
