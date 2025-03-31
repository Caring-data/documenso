import { prisma } from '@documenso/prisma';
import { EntityStatus } from '@documenso/prisma/client';

export interface GetTemplateByDirectLinkTokenOptions {
  token: string;
}

export const getTemplateByDirectLinkToken = async ({
  token,
}: GetTemplateByDirectLinkTokenOptions) => {
  const template = await prisma.template.findFirstOrThrow({
    where: {
      directLink: {
        token,
        enabled: true,
      },
      activityStatus: { not: EntityStatus.INACTIVE },
      deletedAt: null,
    },
    include: {
      directLink: true,
      recipients: {
        include: {
          fields: true,
        },
      },
      templateDocumentData: true,
      templateMeta: true,
    },
  });

  return {
    ...template,
    fields: template.recipients.map((recipient) => recipient.fields).flat(),
  };
};
