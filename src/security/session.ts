import { login, logout } from '@/api/auth';
import { getBasicInformation } from '@/api/endpoints/device';
import { RouterError } from '@/api/errors';
import {
  checkPostLogin,
  checkPreLogin,
  isExpectedModel,
  postLoginFingerprint,
  preLoginFingerprint,
  trustPostLogin,
  trustPreLogin,
} from './routerIdentity';

// AGENTS.md §8.3 session limits.
export const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
export const BACKGROUND_TIMEOUT_MS = 5 * 60 * 1000;

// App-side attempt limit, stricter than the router's own lock.
export const MAX_ATTEMPTS = 3;
export const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

export class AttemptLimiter {
  private attempts: number[] = [];

  constructor(
    private readonly max = MAX_ATTEMPTS,
    private readonly windowMs = ATTEMPT_WINDOW_MS,
  ) {}

  /** Seconds to wait before another attempt is allowed (0 = allowed now). */
  waitSeconds(now = Date.now()): number {
    this.attempts = this.attempts.filter((t) => now - t < this.windowMs);
    if (this.attempts.length < this.max) return 0;
    const oldest = this.attempts[0] ?? now;
    return Math.ceil((oldest + this.windowMs - now) / 1000);
  }

  record(now = Date.now()): void {
    this.attempts.push(now);
  }

  reset(): void {
    this.attempts = [];
  }
}

/**
 * Login with router identity checks (AGENTS.md §8.5):
 * 1. pre-login pin must match before the password hash is sent;
 * 2. post-login pin must match, otherwise log out immediately.
 * `acceptNewIdentity` is only passed after the user chose "Trust new router" and
 * re-authenticated on the device.
 */
export async function secureLogin(
  username: string,
  password: string,
  acceptNewIdentity = false,
): Promise<void> {
  const { deviceName } = await getBasicInformation();
  const pre = await preLoginFingerprint();
  const preResult = await checkPreLogin(pre);
  const suspicious = preResult === 'mismatch' || !isExpectedModel(deviceName);
  if (suspicious && !acceptNewIdentity) throw new RouterError('identity_mismatch');

  await login(username, password);

  const post = await postLoginFingerprint();
  if ((await checkPostLogin(post)) === 'mismatch' && !acceptNewIdentity) {
    await logout().catch(() => undefined);
    throw new RouterError('identity_mismatch');
  }
  await trustPreLogin(pre);
  await trustPostLogin(post);
}
