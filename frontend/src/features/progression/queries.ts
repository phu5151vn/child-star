import { useQuery } from '@tanstack/react-query';
import { api, type BadgeCatalogItem, type Progression } from '@/api/client';

/** Query key cho tiến trình của 1 con — dùng chung để invalidate sau approve/redeem. */
export const progressionKey = (childId?: string | null) => ['progression', childId] as const;

/** Query key cho catalog huy hiệu hệ thống. */
export const badgesKey = ['badges'] as const;

/** Tiến trình (level/streak/badges) của 1 con. GET /children/{id}/progression. */
export function useProgression(childId?: string | null) {
  return useQuery({
    queryKey: progressionKey(childId),
    queryFn: () => api.get<Progression>(`/children/${childId}/progression`),
    enabled: !!childId,
  });
}

/** Catalog định nghĩa huy hiệu hệ thống. GET /badges. */
export function useBadges() {
  return useQuery({
    queryKey: badgesKey,
    queryFn: () => api.get<BadgeCatalogItem[]>('/badges'),
    staleTime: 5 * 60 * 1000, // catalog gần như tĩnh
  });
}
