import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, View } from 'react-native';

import { logout as apiLogout, changeAdminPassword } from '@/api/auth';
import { routerClient } from '@/api/client';
import { RouterError, isRouterError } from '@/api/errors';
import {
  forgetPassword,
  loadRememberedPassword,
  rememberPassword,
} from '@/security/credentials';
import {
  AttemptLimiter,
  BACKGROUND_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  secureLogin,
} from '@/security/session';

export type AuthStatus = 'logged_out' | 'logged_in';

interface LoginOptions {
  remember?: boolean;
  acceptNewIdentity?: boolean;
}

interface AuthContextValue {
  status: AuthStatus;
  login: (
    username: string,
    password: string,
    options?: LoginOptions,
  ) => Promise<{ remembered: boolean }>;
  /** Returns false if the user cancelled the biometric prompt. */
  loginWithSaved: (username: string, acceptNewIdentity?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  /**
   * Change the admin password. On success the router ends the session and the saved
   * password (now wrong) is forgotten, so the user must log in again.
   */
  changePassword: (current: string, next: string) => Promise<void>;
  /** Called when the router says the session is gone (100003). */
  sessionExpired: () => void;
  /** Seconds the app-side limiter wants the user to wait. */
  limiterWait: () => number;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('logged_out');
  const limiter = useRef(new AttemptLimiter()).current;
  // Set on login; only read while logged in.
  const lastActivity = useRef(0);
  const backgroundedAt = useRef<number | null>(null);

  const endSession = useCallback(() => {
    routerClient.clearSession();
    queryClient.removeQueries({ predicate: (q) => q.meta?.auth === true });
    setStatus('logged_out');
  }, [queryClient]);

  const doLogin = useCallback(
    async (username: string, password: string, options: LoginOptions = {}) => {
      const wait = limiter.waitSeconds();
      if (wait > 0) throw new RouterError('too_many_attempts', undefined, wait);
      limiter.record();
      await secureLogin(username, password, options.acceptNewIdentity);
      limiter.reset();
      // Save before flipping to logged_in: the biometric prompt pauses the activity,
      // and re-rendering every screen underneath it crashed Fabric in release builds.
      let remembered = false;
      if (options.remember) {
        try {
          await rememberPassword(username, password);
          remembered = true;
        } catch {
          // No biometrics / screen lock: stay logged in, just don't store it.
        }
      }
      lastActivity.current = Date.now();
      setStatus('logged_in');
      return { remembered };
    },
    [limiter],
  );

  const loginWithSaved = useCallback(
    async (username: string, acceptNewIdentity = false) => {
      const saved = await loadRememberedPassword();
      if (saved === null) return false;
      try {
        await doLogin(username, saved, { acceptNewIdentity });
        return true;
      } catch (e) {
        // A saved password that no longer works is wiped (AGENTS.md §8.3).
        if (e instanceof RouterError && e.kind === 'wrong_password') await forgetPassword();
        throw e;
      }
    },
    [doLogin],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Router unreachable: still forget everything locally.
    }
    endSession();
  }, [endSession]);

  const changePassword = useCallback(
    async (current: string, next: string) => {
      try {
        await changeAdminPassword(current, next);
      } catch (e) {
        // Like the web UI: too many wrong tries (108008) or a dead token end the session.
        if (isRouterError(e, 'too_many_attempts') || isRouterError(e, 'bad_token') || isRouterError(e, 'login_required')) {
          endSession();
        }
        throw e;
      }
      await forgetPassword().catch(() => undefined);
      endSession();
    },
    [endSession],
  );

  // Idle timeout + background timeout (AGENTS.md §8.3).
  useEffect(() => {
    if (status !== 'logged_in') return;
    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_TIMEOUT_MS) void logout();
    }, 30_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active' && backgroundedAt.current !== null) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away > BACKGROUND_TIMEOUT_MS) void logout();
        else lastActivity.current = Date.now();
      }
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [status, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      login: doLogin,
      loginWithSaved,
      logout,
      changePassword,
      sessionExpired: endSession,
      limiterWait: () => limiter.waitSeconds(),
    }),
    [status, doLogin, loginWithSaved, logout, changePassword, endSession, limiter],
  );

  return (
    <AuthContext.Provider value={value}>
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => {
          lastActivity.current = Date.now();
          return false;
        }}
      >
        {children}
      </View>
    </AuthContext.Provider>
  );
}
