import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getBasicInformation } from '@/api/endpoints/device';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useAuth } from '@/state/AuthProvider';
import { clearRebootRequested, isRebootRequested } from '@/state/rebootGate';
import { colors, space } from '@/theme';

const FIRST_CHECK_MS = 20_000;
const CHECK_EVERY_MS = 5_000;
const GIVE_UP_MS = 4 * 60_000;

type Phase = 'waiting' | 'back' | 'slow';

/**
 * Waits for the router to come back after a reboot (DESIGN.md §11). Only works right
 * after a reboot the user confirmed; opened any other way (deep link) it goes home.
 */
export default function RebootingScreen() {
  const [allowed] = useState(() => isRebootRequested());
  if (!allowed) return <Redirect href="/" />;
  return <Waiting />;
}

function Waiting() {
  const { sessionExpired } = useAuth();
  const [phase, setPhase] = useState<Phase>('waiting');
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
    // A reboot ends the router session.
    sessionExpired();
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const check = async () => {
      try {
        await getBasicInformation();
        if (!cancelled) setPhase('back');
        return;
      } catch {
        if (Date.now() - startedAt.current > GIVE_UP_MS) {
          if (!cancelled) setPhase('slow');
          return;
        }
      }
      if (!cancelled) timer = setTimeout(check, CHECK_EVERY_MS);
    };
    timer = setTimeout(check, FIRST_CHECK_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionExpired]);

  const done = () => {
    clearRebootRequested();
    router.dismissTo('/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        {phase === 'waiting' && <ActivityIndicator size="large" color={colors.primary} />}
        <AppText variant="title" style={styles.center}>
          {phase === 'back' ? 'Router is back online' : phase === 'slow' ? 'Taking longer than usual' : 'Rebooting your router…'}
        </AppText>
        <AppText variant="body" color={colors.textSecondary} style={styles.center}>
          {phase === 'back'
            ? 'Log in again to manage your router.'
            : phase === 'slow'
              ? 'Check that the router is powered on and your phone is on its Wi-Fi.'
              : 'Waiting for the router. This usually takes 1–2 minutes.'}
        </AppText>
      </View>
      {phase !== 'waiting' && (
        <View style={styles.footer}>
          <Button label="Done" onPress={done} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxl },
  center: { textAlign: 'center' },
  footer: { padding: space.lg },
});
