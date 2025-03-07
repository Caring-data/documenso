import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TemplateSchema } from '@documenso/prisma/generated/zod';
import type { TCreateTemplateMutationSchema } from '@documenso/trpc/server/template-router/schema';

export type CreateTemplateOptions = TCreateTemplateMutationSchema & {
  userId: number;
  teamId?: number;
  formKey?: string;
};

export const ZCreateTemplateResponseSchema = TemplateSchema;

export type TCreateTemplateResponse = z.infer<typeof ZCreateTemplateResponseSchema>;

export const createTemplate = async ({
  title,
  userId,
  teamId,
  templateDocumentDataId,
  formKey = '',
}: CreateTemplateOptions) => {
  if (teamId) {
    await prisma.team.findFirstOrThrow({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
    });
  }

  return await prisma.template.create({
    data: {
      title,
      userId,
      templateDocumentDataId,
      teamId,
      formKey,
    },
  });
};
