import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getLoginState } from '@/api/auth';
import { isRouterError, userMessage } from '@/api/errors';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import {
  canRememberPassword,
  getRememberedUsername,
  hasRememberedPassword,
} from '@/security/credentials';
import { NO_LOCK_MESSAGE, requireDeviceAuth } from '@/security/deviceAuth';
import { useAuth } from '@/state/AuthProvider';
import { useSnackbar } from '@/state/SnackbarProvider';
import { colors, radius, sizes, space } from '@/theme';

type Pending = { kind: 'typed' } | { kind: 'saved' };

export default function LoginScreen() {
  // AGENTS.md §8.7: no screenshots or recents preview of this screen.
  usePreventScreenCapture();

  const auth = useAuth();
  const snackbar = useSnackbar();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(() => auth.limiterWait());
  const [busy, setBusy] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [mismatch, setMismatch] = useState<Pending | null>(null);
  const canRemember = canRememberPassword();

  useEffect(() => {
    void hasRememberedPassword().then(setHasSaved);
    void getRememberedUsername().then((u) => u && setUsername(u));
    getLoginState()
      .then((s) => s.locked && setWaitSeconds(s.waitSeconds))
      .catch(() => undefined);
  }, []);

  // Live lock countdown (DESIGN.md §9.6).
  useEffect(() => {
    if (waitSeconds <= 0) return;
    const t = setTimeout(() => setWaitSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [waitSeconds]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const handleError = (e: unknown, pending: Pending) => {
    if (isRouterError(e, 'identity_mismatch')) {
      setMismatch(pending);
      return;
    }
    if (isRouterError(e, 'too_many_attempts')) {
      setWaitSeconds(e.waitSeconds ?? 60);
      setError('Too many attempts.');
      return;
    }
    setError(userMessage(e));
  };

  const submit = async (acceptNewIdentity = false) => {
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { remembered } = await auth.login(username.trim(), password, { remember, acceptNewIdentity });
      if (remember && !remembered) snackbar.show("Logged in. Couldn't save the password on this phone.");
      // No state changes after this: re-rendering the form (busy → editable flips the
      // inputs' and button's opacity) while the modal's exit transition runs made Fabric
      // re-parent views that react-native-screens still held, and release builds crashed
      // with "addViewAt: … already has a parent". The password state goes with the screen.
      close();
    } catch (e) {
      handleError(e, { kind: 'typed' });
      setBusy(false);
    }
  };

  const loginSaved = async (acceptNewIdentity = false) => {
    setBusy(true);
    setError(null);
    try {
      // Same as submit(): leave without touching state on success.
      if (await auth.loginWithSaved(username.trim(), acceptNewIdentity)) return close();
    } catch (e) {
      if (isRouterError(e, 'wrong_password')) setHasSaved(false);
      handleError(e, { kind: 'saved' });
    }
    setBusy(false);
  };

  // "Trust new router" needs device re-auth (AGENTS.md §8.8).
  const trustNewRouter = async () => {
    const pending = mismatch;
    setMismatch(null);
    const result = await requireDeviceAuth('Confirm this is your router');
    if (result === 'no_lock') return setError(NO_LOCK_MESSAGE);
    if (result !== 'ok' || !pending) return;
    if (pending.kind === 'saved') await loginSaved(true);
    else await submit(true);
  };

  const locked = waitSeconds > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior="height" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={space.sm}
            style={styles.close}
          >
            <Ionicons name="close" size={sizes.icon} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="wifi" size={32} color={colors.primary} />
            </View>
            <AppText variant="title">R App</AppText>
            <AppText variant="body" color={colors.textSecondary}>
              Log in to your router
            </AppText>
          </View>

          {mismatch ? (
            <Card>
              <AppText variant="heading" color={colors.danger}>
                {"This doesn't look like your router"}
              </AppText>
              <AppText variant="body" color={colors.textSecondary}>
                The router answering at this address is different from the one you used before.
                Your password was not sent. Only continue if you replaced or reset your router.
              </AppText>
              <Button label="Cancel" variant="secondary" onPress={() => setMismatch(null)} />
              <Button label="Trust new router" variant="danger" onPress={() => void trustNewRouter()} />
            </Card>
          ) : (
            <Card>
              <Input
                label="Username"
                value={username}
                onChangeText={setUsername}
                autoComplete="username"
                textContentType="username"
                editable={!busy}
              />
              <Input
                label="Password"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError(null);
                }}
                secret
                autoComplete="password"
                textContentType="password"
                importantForAutofill="yes"
                editable={!busy}
                returnKeyType="go"
                onSubmitEditing={() => !locked && void submit()}
                error={locked ? `${error ?? 'Too many attempts.'} Try again in ${waitSeconds} s.` : error}
              />
              <View style={styles.rememberRow}>
                <View style={styles.flex}>
                  <AppText variant="body">Remember password</AppText>
                  <AppText variant="caption" color={colors.textSecondary}>
                    {canRemember
                      ? 'Saved encrypted. Unlock with your fingerprint or PIN.'
                      : 'Set a screen lock on your phone to use this.'}
                  </AppText>
                </View>
                <Switch
                  value={remember}
                  onValueChange={setRemember}
                  disabled={!canRemember || busy}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.surface}
                  accessibilityLabel="Remember password"
                />
              </View>
              <Button
                label="Log in"
                loading={busy}
                loadingLabel="Logging in…"
                disabled={locked}
                onPress={() => void submit()}
              />
              {hasSaved && (
                <Button
                  label="Use saved password"
                  variant="secondary"
                  icon="finger-print"
                  disabled={locked || busy}
                  onPress={() => void loginSaved()}
                />
              )}
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.xxl, paddingBottom: space.xxxl },
  close: { alignSelf: 'flex-end', padding: space.sm },
  brand: { alignItems: 'center', gap: space.xs },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
