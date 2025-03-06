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
  const recipientId = 1;

  const { status, body } = await client.createField({
    params: {
      id: documentId,
    },
    body: {
      type: 'SIGNATURE',
      pageHeight: 2.5, // percent of page to occupy in height
      pageWidth: 5, // percent of page to occupy in width
      pageX: 10, // percent from left
      pageY: 10, // percent from top
      pageNumber: 1,
      recipientId,
    },
  });

  if (status !== 200) {
    throw new Error('Failed to create field');
  }

  const { id: fieldId } = body;

  console.log(`Field created with id: ${fieldId}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
