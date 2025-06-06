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
  const recipientId = '1';

  const { status } = await client.deleteRecipient({
    params: {
      id: documentId,
      recipientId,
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
