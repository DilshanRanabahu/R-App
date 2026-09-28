import { useCallback, useState } from 'react';

/** Pull-to-refresh state that ignores background polling (DESIGN.md §10). */
export function useManualRefresh(refresh: () => Promise<unknown>[]) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.allSettled(refresh()).finally(() => setRefreshing(false));
  }, [refresh]);
  return { refreshing, onRefresh };
}
