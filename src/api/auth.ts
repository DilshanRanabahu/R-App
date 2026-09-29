import { routerClient } from './client';
import { loginPasswordHash, rsaEncryptHex } from './crypto';
import { getPublicKey } from './endpoints/device';
import { toNumber } from './endpoints/parse';
import { RouterError } from './errors';
import type { LoginState, LoginStateRaw } from './types';
import { escapeLikeWebUi } from './xml';

export async function getLoginState(): Promise<LoginState> {
  const r = await routerClient.get<LoginStateRaw>('/api/user/state-login');
  return {
    loggedIn: r.State === '0',
    passwordType: r.password_type ?? '',
    locked: r.lockstatus === '1',
    waitSeconds: toNumber(r.remainwaittime),
    firstLogin: r.firstlogin === '1',
    rsaPadding: r.rsapadingtype === '1' ? 'oaep' : 'pkcs1',
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

/**
 * Change the admin password exactly like the router's own web UI (emui webui 6):
 * POST user/password_scram with username / currentpassword / newpassword, values
 * escaped like the UI's xss(), the whole XML RSA-encrypted with the router's key.
 * Never retried: a repeat could count as another wrong attempt (108008 locks you out).
 * The router ends the session afterwards, so the caller must log out locally.
 */
export async function changeAdminPassword(current: string, next: string): Promise<void> {
  const [state, key] = await Promise.all([getLoginState(), getPublicKey()]);
  if (!key.encpubkeyn || !key.encpubkeye) throw new RouterError('invalid_response');
  const publicKey = { n: key.encpubkeyn, e: key.encpubkeye };
  await routerClient.post(
    '/api/user/password_scram',
    // The web UI always changes the "admin" account.
    { username: 'admin', currentpassword: current, newpassword: next },
    {
      escape: escapeLikeWebUi,
      encrypt: (xml) => rsaEncryptHex(xml, publicKey, state.rsaPadding),
      retryBadToken: false,
    },
  );
}
