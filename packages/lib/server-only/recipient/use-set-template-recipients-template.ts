import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

import { NEXT_PUBLIC_CD_SERVICE_API_KEY, NEXT_PUBLIC_CD_SERVICE_URL } from '../../constants/app';

export type SetTemplateRecipientsTemplateOptions = {
  externalId: string;
};

export type SetTemplateRecipientsTemplateDataOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestData: any;
};

export const useSetTemplateRecipientsTemplate = ({
  externalId,
}: SetTemplateRecipientsTemplateOptions) => {
  return useMutation({
    mutationFn: async ({ requestData }: SetTemplateRecipientsTemplateDataOptions) => {
      const { data } = await axios.patch(
        `${NEXT_PUBLIC_CD_SERVICE_URL()}/v1/forms/templates/${externalId}/signers`,
        requestData,
        {
          headers: {
            'x-api-key': NEXT_PUBLIC_CD_SERVICE_API_KEY(),
          },
        },
      );
      return data.data;
    },
  });
};
