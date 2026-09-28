import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

import { isRouterError } from '@/api/errors';

// Pause all polling while the app is in the background (AGENTS.md §6).
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (s: AppStateStatus) => setFocused(s === 'active'));
  return () => sub.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry only transient network problems, never auth errors.
      retry: (count, error) =>
        count < 1 && (isRouterError(error, 'timeout') || isRouterError(error, 'unreachable')),
      refetchIntervalInBackground: false,
      staleTime: 1000,
      gcTime: 60_000,
    },
    mutations: { retry: false },
  },
});
