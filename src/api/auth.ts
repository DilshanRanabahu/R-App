import { routerClient } from './client';
import { loginPasswordHash } from './crypto';
import { RouterError } from './errors';
import type { LoginState, LoginStateRaw } from './types';
import { toNumber } from './endpoints/parse';

export async function getLoginState(): Promise<LoginState> {
  const r = await routerClient.get<LoginStateRaw>('/api/user/state-login');
  return {
    loggedIn: r.State === '0',
    passwordType: r.password_type ?? '',
    locked: r.lockstatus === '1',
    waitSeconds: toNumber(r.remainwaittime),
    firstLogin: r.firstlogin === '1',
  };
}

/**
 * One login attempt. Never loops: callers decide whether to try again
 * (AGENTS.md §8.3). The password only lives in this call's scope.
 */
export async function login(username: string, password: string): Promise<void> {
  await routerClient.newSession();
  const state = await getLoginState();
  if (state.locked) throw new RouterError('too_many_attempts', undefined, state.waitSeconds);
  if (state.passwordType !== '4') throw new RouterError('not_supported');

  await routerClient.post('/api/user/login', async (token) => ({
    Username: username,
    Password: await loginPasswordHash(username, password, token),
    password_type: 4,
  }));
}

export async function logout(): Promise<void> {
  try {
    await routerClient.post('/api/user/logout', { Logout: 1 });
  } finally {
    routerClient.clearSession();
  }
}
