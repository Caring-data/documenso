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

  const page = 1;
  const perPage = 10;

  const { status, body } = await client.getDocuments({
    query: {
      page,
      perPage,
    },
  });

  if (status !== 200) {
    throw new Error('Failed to get documents');
  }

  for (const document of body.documents) {
    console.log(`Got document with id: ${document.id} and title: ${document.title}`);
  }

  console.log(`Total documents: ${body.totalPages * perPage}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
