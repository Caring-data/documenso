import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export interface UseGetResidentInfoOptions {
  residentId: string;
}

export const useGetResidentInfo = ({ residentId }: UseGetResidentInfoOptions) => {
  const BASE_URL = process.env.NEXT_PUBLIC_CD_SERVICE_URL || 'http://localhost:3005/api';

  return useQuery({
    queryKey: ['get-resident-info', residentId],
    queryFn: async () => {
      const { data } = await axios.get(`${BASE_URL}/v1/residents/forms/resident/${residentId}`);
      return data.data;
    },
    enabled: !!residentId,
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
