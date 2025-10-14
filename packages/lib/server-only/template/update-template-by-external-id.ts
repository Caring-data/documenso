'use server';

import { prisma } from '@documenso/prisma';
import type { DocumentVisibility, Template, TemplateMeta } from '@documenso/prisma/client';

import type { TDocumentAccessAuthTypes, TDocumentActionAuthTypes } from '../../types/document-auth';

export type UpdateTemplateByExternalIdOptions = {
  templateId: number;
  data?: {
    title?: string;
    externalId?: string | null;
    visibility?: DocumentVisibility;
    globalAccessAuth?: TDocumentAccessAuthTypes | null;
    globalActionAuth?: TDocumentActionAuthTypes | null;
    publicTitle?: string;
    publicDescription?: string;
    type?: Template['type'];
  };
  meta?: Partial<Omit<TemplateMeta, 'id' | 'templateId'>>;
};

export type UpdateTemplateDataOptions = {
  id: string;
  initialData: string;
  data: string;
};

export const updateTemplateByExternalId = async ({
  templateId,
  meta = {},
  data = {},
}: UpdateTemplateByExternalIdOptions) => {
  const template = await prisma.template.findFirstOrThrow({
    where: {
      id: templateId,
    },
    include: {
      templateMeta: true,
    },
  });

  if (Object.values(data).length === 0 && Object.keys(meta).length === 0) {
    return template;
  }

  return await prisma.template.update({
    where: {
      id: templateId,
    },
    data: {
      title: data?.title,
      externalId: data?.externalId,
      type: data?.type,
      visibility: data?.visibility,
      publicDescription: data?.publicDescription,
      publicTitle: data?.publicTitle,
      templateMeta: {
        upsert: {
          where: {
            templateId,
          },
          create: {
            ...meta,
            emailSettings: meta?.emailSettings || undefined,
          },
          update: {
            ...meta,
            emailSettings: meta?.emailSettings || undefined,
          },
        },
      },
    },
  });
};

export const updateDocumentData = async ({ id, initialData, data }: UpdateTemplateDataOptions) => {
  return await prisma.documentData.update({
    where: { id },
    data: { initialData, data },
  });
};
