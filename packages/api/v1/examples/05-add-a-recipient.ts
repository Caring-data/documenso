import { initClient } from '@ts-rest/core';

import { NEXT_PUBLIC_API_URL } from '@documenso/lib/constants/app';

import { ApiContractV1 } from '../contract';

const main = async () => {
  const client = initClient(ApiContractV1, {
    baseUrl: NEXT_PUBLIC_API_URL(),
    baseHeaders: {
      authorization: 'Bearer <my-token>',
    },
  });

  const documentId = '1';

  const { status, body } = await client.createRecipient({
    params: {
      id: documentId,
    },
    body: {
      name: 'John Doe',
      email: 'john@example.com',
      role: 'APPROVER',
    },
  });

  if (status !== 200) {
    throw new Error('Failed to add recipient');
  }

  const { id: recipientId } = body;

  console.log(`Recipient added with id: ${recipientId}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
