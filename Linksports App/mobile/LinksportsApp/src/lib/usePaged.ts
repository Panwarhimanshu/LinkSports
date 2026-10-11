import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from './api';

// Wraps the backend's { data: [...], pagination: { page, pages } } list responses.
export function usePaged<T = any>(key: unknown[], url: string, params: Record<string, unknown> = {}, enabled = true) {
  const q = useInfiniteQuery({
    queryKey: [url, ...key, params],
    initialPageParam: 1,
    enabled,
    queryFn: async ({ pageParam }) => {
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
      const res = await api.get(url, { params: { ...clean, page: pageParam, limit: 20 } });
      return res.data as { data: T[]; pagination?: { page: number; pages: number } };
    },
    getNextPageParam: (last) =>
      last.pagination && last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined,
  });
  return { ...q, items: (q.data?.pages ?? []).flatMap((p) => p.data) as T[] };
}
