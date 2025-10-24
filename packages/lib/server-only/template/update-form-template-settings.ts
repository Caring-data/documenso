import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

import { NEXT_PUBLIC_CD_SERVICE_API_KEY, NEXT_PUBLIC_CD_SERVICE_URL } from '../../constants/app';

export type UpdateFormTemplateSettingsOptions = {
  externalId: string;
};

export type UpdateFormTemplateSettingsDataOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestData: any;
};

export const useUpdateFormTemplateSettings = ({
  externalId,
}: UpdateFormTemplateSettingsOptions) => {
  return useMutation({
    mutationFn: async ({ requestData }: UpdateFormTemplateSettingsDataOptions) => {
      const { data } = await axios.patch(
        `${NEXT_PUBLIC_CD_SERVICE_URL()}/v1/forms/templates/${externalId}/settings`,
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
