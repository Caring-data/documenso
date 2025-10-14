import { prisma } from '@documenso/prisma';
import type { Recipient } from '@documenso/prisma/client';
import { RecipientRole } from '@documenso/prisma/client';

import {
  type TRecipientActionAuthTypes,
  ZRecipientAuthOptionsSchema,
} from '../../types/document-auth';
import { nanoid } from '../../universal/id';
import { createRecipientAuthOptions } from '../../utils/document-auth';

export type SetTemplateRecipientsTemplateOptions = {
  templateId: number;
  recipients: {
    id?: number;
    email: string;
    name: string;
    role: RecipientRole;
    signingOrder?: number | null;
    actionAuth?: TRecipientActionAuthTypes | null;
  }[];
};

export const setTemplateRecipientsTemplate = async ({
  templateId,
  recipients,
}: SetTemplateRecipientsTemplateOptions) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
    },
  });

  if (!template) {
    throw new Error('Template not found');
  }

  const existingRecipients = await prisma.recipient.findMany({
    where: {
      templateId,
    },
  });

  const removedRecipients = existingRecipients.filter(
    (existingRecipient) =>
      !recipients.find(
        (recipient) =>
          recipient.id === existingRecipient.id || recipient.email === existingRecipient.email,
      ),
  );

  const linkedRecipients = recipients.map((recipient) => {
    const existing = existingRecipients.find(
      (existingRecipient) =>
        existingRecipient.id === recipient.id || existingRecipient.email === recipient.email,
    );

    return {
      ...recipient,
      _persisted: existing,
    };
  });

  const persistedRecipients = await prisma.$transaction(async (tx) => {
    return await Promise.all(
      linkedRecipients.map(async (recipient) => {
        let authOptions = ZRecipientAuthOptionsSchema.parse(recipient._persisted?.authOptions);

        if (recipient.actionAuth !== undefined) {
          authOptions = createRecipientAuthOptions({
            accessAuth: authOptions.accessAuth,
            actionAuth: recipient.actionAuth,
          });
        }

        const upsertedRecipient = await tx.recipient.upsert({
          where: {
            id: recipient._persisted?.id ?? -1,
            templateId,
          },
          update: {
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            templateId,
            authOptions,
          },
          create: {
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            token: nanoid(),
            templateId,
            authOptions,
          },
        });

        const recipientId = upsertedRecipient.id;
        if (
          recipient._persisted &&
          recipient._persisted.role !== recipient.role &&
          (recipient.role === RecipientRole.CC || recipient.role === RecipientRole.VIEWER)
        ) {
          await tx.field.deleteMany({
            where: {
              recipientId,
            },
          });
        }

        return upsertedRecipient;
      }),
    );
  });

  if (removedRecipients.length > 0) {
    await prisma.recipient.deleteMany({
      where: {
        id: {
          in: removedRecipients.map((recipient) => recipient.id),
        },
      },
    });
  }

  const filteredRecipients: Recipient[] = existingRecipients.filter((recipient) => {
    const isRemoved = removedRecipients.find(
      (removedRecipient) => removedRecipient.id === recipient.id,
    );
    const isUpdated = persistedRecipients.find(
      (persistedRecipient) => persistedRecipient.id === recipient.id,
    );

    return !isRemoved && !isUpdated;
  });

  return {
    recipients: [...filteredRecipients, ...persistedRecipients],
  };
};
