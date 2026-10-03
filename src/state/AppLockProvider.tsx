import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { requireDeviceAuth, type DeviceAuthResult } from '@/security/deviceAuth';
import { colors, radius, sizes, space } from '@/theme';
import { shouldRelock } from './appLock';

// Optional app lock (AGENTS.md §8.8): fingerprint / device PIN when the app opens or
// comes back after more than a minute. Only the on/off choice is stored.
const KEY = 'app_lock_v1';

interface AppLockValue {
  enabled: boolean;
  /** Turning it on or off asks for fingerprint / PIN first. */
  setEnabled: (enabled: boolean) => Promise<DeviceAuthResult>;
}

const AppLockContext = createContext<AppLockValue>({ enabled: false, setEnabled: async () => 'cancelled' });

export function useAppLock(): AppLockValue {
  return useContext(AppLockContext);
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  // Until the setting is read the app stays covered, so nothing shows before a lock.
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const [noLock, setNoLock] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  // The system prompt itself can pause the app; that must not count as "away".
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      const result = await requireDeviceAuth('Unlock R App');
      if (result === 'ok') setLocked(false);
      // The phone's screen lock was removed after app lock was switched on: there is
      // nothing left to ask for, so say so instead of locking the owner out.
      setNoLock(result === 'no_lock');
    } finally {
      prompting.current = false;
      backgroundedAt.current = null;
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((value) => {
        const on = value === '1';
        setEnabledState(on);
        setLocked(on);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  // Ask straight away when the lock appears.
  useEffect(() => {
    if (locked) void unlock();
  }, [locked, unlock]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (prompting.current) return;
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active') {
        if (shouldRelock(backgroundedAt.current, Date.now())) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const setEnabled = useCallback(async (next: boolean) => {
    prompting.current = true;
    try {
      const result = await requireDeviceAuth(next ? 'Turn on app lock' : 'Turn off app lock');
      if (result !== 'ok') return result;
      await AsyncStorage.setItem(KEY, next ? '1' : '0');
      setEnabledState(next);
      return result;
    } finally {
      prompting.current = false;
      backgroundedAt.current = null;
    }
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);
  const covered = !loaded || locked;

  return (
    <AppLockContext.Provider value={value}>
      {children}
      {covered && (
        <SafeAreaView style={styles.cover} accessibilityViewIsModal>
          {locked && (
            <View style={styles.content}>
              <View style={styles.tile}>
                <Ionicons name="lock-closed" size={sizes.icon + space.sm} color={colors.primary} />
              </View>
              <AppText variant="title" accessibilityRole="header">
                R App is locked
              </AppText>
              <AppText variant="body" color={colors.textSecondary} style={styles.center}>
                {noLock
                  ? 'Your phone has no screen lock any more, so app lock can’t protect the app. Set a screen lock in your phone’s settings.'
                  : 'Use your fingerprint or phone PIN to open it.'}
              </AppText>
              <View style={styles.action}>
                {noLock ? (
                  <Button label="Open anyway" variant="secondary" onPress={() => setLocked(false)} />
                ) : (
                  <Button label="Unlock" icon="finger-print" onPress={() => void unlock()} />
                )}
              </View>
            </View>
          )}
        </SafeAreaView>
      )}
    </AppLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  content: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xxl },
  tile: {
    width: sizes.listRow + space.sm,
    height: sizes.listRow + space.sm,
    borderRadius: radius.card,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  center: { textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: space.md },
});
