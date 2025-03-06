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
  const fieldId = '1';

  const { status } = await client.updateField({
    params: {
      id: documentId,
      fieldId,
    },
    body: {
      type: 'SIGNATURE',
      pageHeight: 2.5, // percent of page to occupy in height
      pageWidth: 5, // percent of page to occupy in width
      pageX: 10, // percent from left
      pageY: 10, // percent from top
      pageNumber: 1,
    },
  });

  if (status !== 200) {
    throw new Error('Failed to update field');
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
