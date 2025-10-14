import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export type GetDefaultFormTemplateConfigOptions = {
  templateId: string;
};

export const useGetDefaultFormTemplateConfig = ({
  templateId,
}: GetDefaultFormTemplateConfigOptions) => {
  const BASE_URL = process.env.NEXT_PUBLIC_CD_SERVICE_URL || 'http://localhost:3005/api';

  return useQuery({
    queryKey: ['default-form-template-config', templateId],
    queryFn: async () => {
      const { data } = await axios.get(`${BASE_URL}/v1/forms/default-config-form/${templateId}`);
      return data.data;
    },
    enabled: !!templateId,
    staleTime: 500,
    gcTime: 1000,
    refetchOnMount: (query) => {
      const data = query.state.data;
      return !data;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    retry: (failureCount, error: any) => {
      const status = error?.status ?? error?.response?.status;
      if (status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
};
