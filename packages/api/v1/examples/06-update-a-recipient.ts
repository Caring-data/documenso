import { initClient } from '@ts-rest/core';

import { ApiContractV1 } from '../contract';
import { NEXT_PUBLIC_API_URL } from '@documenso/lib/constants/app';

const main = async () => {
  const client = initClient(ApiContractV1, {
    baseUrl: NEXT_PUBLIC_API_URL(),
    baseHeaders: {
      authorization: 'Bearer <my-token>',
    },
  });

  const documentId = '1';
  const recipientId = '1';

  const { status } = await client.updateRecipient({
    params: {
      id: documentId,
      recipientId,
    },
    body: {
      name: 'Johnathon Doe',
    },
  });

  if (status !== 200) {
    throw new Error('Failed to update recipient');
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
