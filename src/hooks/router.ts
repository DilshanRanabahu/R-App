import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { routerClient } from '@/api/client';
import { getHosts } from '@/api/endpoints/wlan';
import { getBasicInformation, getSignal, rebootRouter } from '@/api/endpoints/device';
import { getMobileData, setMobileData } from '@/api/endpoints/dialup';
import { getSimReady, getStatus, getTrafficStatistics } from '@/api/endpoints/monitoring';
import { getOperator } from '@/api/endpoints/net';
import { isRouterError } from '@/api/errors';
import { useAuth } from '@/state/AuthProvider';
import { useSnackbar } from '@/state/SnackbarProvider';

export function routerHost(): string {
  return routerClient.routerHost;
}

// Polling intervals (AGENTS.md §6).
const FAST = 3000;
const NORMAL = 5000;
const SLOW = 15000;

const every = (focused: boolean, ms: number) => (focused ? ms : false);

// Queries that need a session carry meta.auth so logout can drop their data.
const AUTH_META = { auth: true } as const;

export function useRouterInfo() {
  return useQuery({
    queryKey: ['basicInformation'],
    queryFn: getBasicInformation,
    refetchInterval: SLOW,
  });
}

export function useTraffic(focused: boolean) {
  return useQuery({
    queryKey: ['traffic'],
    queryFn: getTrafficStatistics,
    refetchInterval: every(focused, FAST),
  });
}

export function useOperator(focused: boolean) {
  return useQuery({
    queryKey: ['operator'],
    queryFn: getOperator,
    refetchInterval: every(focused, SLOW),
  });
}

export function useSimReady() {
  return useQuery({ queryKey: ['simReady'], queryFn: getSimReady, refetchInterval: SLOW * 2 });
}

export function useStatus(focused: boolean) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ['status'],
    queryFn: getStatus,
    enabled: status === 'logged_in',
    refetchInterval: every(focused, NORMAL),
    meta: AUTH_META,
  });
}

export function useSignal(focused: boolean) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ['signal'],
    queryFn: getSignal,
    enabled: status === 'logged_in',
    refetchInterval: every(focused, NORMAL),
    meta: AUTH_META,
  });
}

export function useHosts(focused: boolean) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ['hosts'],
    queryFn: getHosts,
    enabled: status === 'logged_in',
    refetchInterval: every(focused, SLOW),
    meta: AUTH_META,
  });
}

export function useMobileData() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ['mobileData'],
    queryFn: getMobileData,
    enabled: status === 'logged_in',
    refetchInterval: SLOW,
    meta: AUTH_META,
  });
}

export function useSetMobileData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setMobileData,
    onSuccess: (_d, enabled) => queryClient.setQueryData(['mobileData'], enabled),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['mobileData'] }),
  });
}

export function useReboot() {
  return useMutation({ mutationFn: rebootRouter });
}

/** Ends the local session when the router reports it expired (100003). */
export function useSessionWatcher(): void {
  const queryClient = useQueryClient();
  const { status, sessionExpired } = useAuth();
  const snackbar = useSnackbar();

  useEffect(() => {
    if (status !== 'logged_in') return;
    const expired = (e: unknown) => isRouterError(e, 'login_required');
    const onExpire = () => {
      sessionExpired();
      snackbar.show('Your session ended. Please log in again.');
    };
    const unsubQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && expired(event.query.state.error)) onExpire();
    });
    const unsubMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && expired(event.mutation?.state.error)) onExpire();
    });
    return () => {
      unsubQueries();
      unsubMutations();
    };
  }, [queryClient, status, sessionExpired, snackbar]);
}
