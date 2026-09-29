import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isRouterError, userMessage } from '@/api/errors';
import { passwordStrength, validateNewAdminPassword, type PasswordStrength } from '@/api/validate';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Input } from '@/components/Input';
import { NO_LOCK_MESSAGE, requireDeviceAuth } from '@/security/deviceAuth';
import { useAuth } from '@/state/AuthProvider';
import { useSnackbar } from '@/state/SnackbarProvider';
import { colors, sizes, space, toneColors, type Tone } from '@/theme';

const STRENGTH: Record<PasswordStrength, { label: string; tone: Tone }> = {
  weak: { label: 'Weak', tone: 'danger' },
  medium: { label: 'Medium', tone: 'warning' },
  strong: { label: 'Strong', tone: 'success' },
};

type Errors = { current?: string; next?: string; confirm?: string; form?: string };

/**
 * Change the router's admin password (FEATURES 1.9). Screenshot-blocked (AGENTS.md §8.7),
 * confirmed, then device re-auth (§8.8). Passwords live only in this screen's state.
 */
export default function ChangePasswordScreen() {
  usePreventScreenCapture();

  const { changePassword } = useAuth();
  const snackbar = useSnackbar();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/router'));

  const check = () => {
    const found: Errors = {};
    if (!current) found.current = 'Enter your current password.';
    const nextError = validateNewAdminPassword(next, current);
    if (nextError) found.next = nextError;
    else if (next !== confirm) found.confirm = "The new passwords don't match.";
    setErrors(found);
    if (Object.keys(found).length === 0) setConfirming(true);
  };

  const submit = async () => {
    setConfirming(false);
    const auth = await requireDeviceAuth('Confirm admin password change');
    if (auth === 'no_lock') return setErrors({ form: NO_LOCK_MESSAGE });
    if (auth !== 'ok') return;

    setBusy(true);
    try {
      await changePassword(current, next);
      snackbar.show('Password changed. Log in with your new password.');
      router.replace('/login');
    } catch (e) {
      if (isRouterError(e, 'too_many_attempts')) {
        snackbar.show('Password entered incorrectly too many times. Please log in again.');
        close();
      } else if (isRouterError(e, 'bad_token') || isRouterError(e, 'login_required')) {
        snackbar.show('Your session ended. Please log in again.');
        close();
      } else if (isRouterError(e, 'wrong_password') || isRouterError(e, 'router')) {
        // The web UI shows "Password incorrect" for every other refusal.
        setErrors({ current: 'Current password is incorrect.' });
      } else {
        setErrors({ form: userMessage(e) });
      }
    } finally {
      setBusy(false);
    }
  };

  const strength = next ? STRENGTH[passwordStrength(next)] : null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior="height" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={space.sm}
              style={styles.back}
            >
              <Ionicons name="arrow-back" size={sizes.icon} color={colors.textPrimary} />
            </Pressable>
            <AppText variant="title" accessibilityRole="header" style={styles.flex}>
              Change admin password
            </AppText>
          </View>

          <Card>
            <Input
              label="Current password"
              value={current}
              onChangeText={(v) => {
                setCurrent(v);
                setErrors({});
              }}
              secret
              autoComplete="password"
              textContentType="password"
              importantForAutofill="yes"
              editable={!busy}
              error={errors.current}
            />
            <View style={styles.field}>
              <Input
                label="New password"
                value={next}
                onChangeText={(v) => {
                  setNext(v);
                  setErrors({});
                }}
                secret
                autoComplete="new-password"
                textContentType="newPassword"
                importantForAutofill="yes"
                editable={!busy}
                error={errors.next}
              />
              {strength && !errors.next ? (
                <AppText variant="caption" color={toneColors(strength.tone).fg}>
                  Strength: {strength.label}
                </AppText>
              ) : null}
              <AppText variant="caption" color={colors.textSecondary}>
                8–32 characters. Mix upper and lower case letters, numbers and symbols for a strong
                password.
              </AppText>
            </View>
            <Input
              label="Confirm new password"
              value={confirm}
              onChangeText={(v) => {
                setConfirm(v);
                setErrors({});
              }}
              secret
              autoComplete="new-password"
              textContentType="newPassword"
              importantForAutofill="yes"
              editable={!busy}
              returnKeyType="done"
              onSubmitEditing={check}
              error={errors.confirm}
            />
            {errors.form ? (
              <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
                {errors.form}
              </AppText>
            ) : null}
            <Button label="Change password" loading={busy} loadingLabel="Changing…" onPress={check} />
          </Card>

          <AppText variant="caption" color={colors.textSecondary}>
            {"After the change you'll be logged out, here and on the router's web page. Log in again " +
              'with the new password. Keep it somewhere safe: if you forget it, the router has to be ' +
              'reset to factory settings.'}
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirming}
        title="Change admin password?"
        message="You'll be logged out and must log in with the new password. If you forget it, the router has to be reset."
        confirmLabel="Change"
        onCancel={() => setConfirming(false)}
        onConfirm={() => void submit()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  back: { padding: space.sm, marginLeft: -space.sm },
  field: { gap: space.xs },
});
