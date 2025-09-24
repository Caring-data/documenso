import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

export type UpdateFormTemplateSettingsOptions = {
  externalId: string;
};

export type UpdateFormTemplateSettingsDataOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestData: any;
};

export const useSetTemplateRecipientsTemplate = ({
  externalId,
}: UpdateFormTemplateSettingsOptions) => {
  const BASE_URL = process.env.NEXT_PUBLIC_CD_SERVICE_URL || 'http://localhost:3005/api';

  return useMutation({
    mutationFn: async ({ requestData }: UpdateFormTemplateSettingsDataOptions) => {
      const { data } = await axios.patch(
        `${BASE_URL}/v1/forms/templates/${externalId}/signers`,
        requestData,
      );
      return data.data;
    },
  });
};
