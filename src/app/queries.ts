import { useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
export const useDb = () => useQuery({ queryKey: ['data'], queryFn: api.listData });
export const invalidateAll = (queryClient: QueryClient) => queryClient.invalidateQueries();
