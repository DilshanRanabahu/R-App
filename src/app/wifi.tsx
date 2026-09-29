import { usePreventScreenCapture } from 'expo-screen-capture';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { isRouterError, userMessage } from '@/api/errors';
import { validateSsid, validateWifiKey } from '@/api/validate';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Input } from '@/components/Input';
import { QrCode } from '@/components/QrCode';
import { LoginRequired, Skeleton } from '@/components/States';
import { SubScreen } from '@/components/SubScreen';
import { useRevealWifiPassword, useSaveWifiNetwork, useWifiNetwork } from '@/hooks/router';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { NO_LOCK_MESSAGE, requireDeviceAuth } from '@/security/deviceAuth';
import { useAuth } from '@/state/AuthProvider';
import { useSnackbar } from '@/state/SnackbarProvider';
import { colors, sizes, space } from '@/theme';
import { wifiQrPayload } from '@/utils/wifiQr';

type Errors = { ssid?: string; password?: string; confirm?: string; form?: string };

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <AppText variant="body" color={colors.textSecondary}>
        {label}
      </AppText>
      <AppText variant="body" style={styles.infoValue} numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

/**
 * Wi-Fi name & password (FEATURES 9.1–9.3). Screenshot-blocked (AGENTS.md §8.7): shows
 * the password and QR on request. Revealing and saving need fingerprint/PIN (§8.8).
 * The password lives only in this screen's state and is dropped when it closes.
 */
export default function WifiScreen() {
  usePreventScreenCapture();

  const focused = useScreenFocus();
  const { status } = useAuth();
  const snackbar = useSnackbar();
  const network = useWifiNetwork(focused);
  const reveal = useRevealWifiPassword();
  const save = useSaveWifiNetwork();

  const [password, setPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const [ssid, setSsid] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [hidden, setHidden] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [confirming, setConfirming] = useState(false);

  const n = network.data;
  // Fill the form whenever fresh settings arrive (first load, after saving).
  const [formFor, setFormFor] = useState<typeof n>(undefined);
  if (n && n !== formFor) {
    setFormFor(n);
    setSsid(n.ssid);
    setHidden(n.hidden);
  }

  // Needs fingerprint/PIN every time; the result is kept only while this screen is open.
  const ensurePassword = async (reason: string): Promise<string | null> => {
    if (password !== null) return password;
    const auth = await requireDeviceAuth(reason);
    if (auth === 'no_lock') {
      snackbar.show(NO_LOCK_MESSAGE);
      return null;
    }
    if (auth !== 'ok') return null;
    setRevealing(true);
    try {
      const value = await reveal();
      setPassword(value);
      return value;
    } catch (e) {
      snackbar.show(userMessage(e));
      return null;
    } finally {
      setRevealing(false);
    }
  };

  const toggleShowPassword = async () => {
    if (showPassword) return setShowPassword(false);
    if (await ensurePassword('Show Wi-Fi password')) setShowPassword(true);
  };

  const toggleQr = async () => {
    if (showQr) return setShowQr(false);
    if (await ensurePassword('Show Wi-Fi QR code')) setShowQr(true);
  };

  const trimmed = ssid.trim();
  const changed = !!n && (trimmed !== n.ssid || hidden !== n.hidden || newPassword !== '');

  const check = () => {
    const found: Errors = {};
    const ssidError = validateSsid(trimmed);
    if (ssidError) found.ssid = ssidError;
    if (newPassword) {
      const keyError = validateWifiKey(newPassword);
      if (keyError) found.password = keyError;
      else if (newPassword !== confirm) found.confirm = "The new passwords don't match.";
    }
    setErrors(found);
    if (Object.keys(found).length === 0) setConfirming(true);
  };

  const submit = async () => {
    setConfirming(false);
    const auth = await requireDeviceAuth('Confirm Wi-Fi change');
    if (auth === 'no_lock') return setErrors({ form: NO_LOCK_MESSAGE });
    if (auth !== 'ok') return;
    const passwordChanged = newPassword !== '';
    save.mutate(
      { ssid: trimmed, hidden, newPassword: passwordChanged ? newPassword : null },
      {
        onSuccess: () => {
          snackbar.show('Wi-Fi saved. Reconnect your phone to the Wi-Fi.');
          setNewPassword('');
          setConfirm('');
          if (passwordChanged) {
            setPassword(null);
            setShowPassword(false);
            setShowQr(false);
          }
        },
        onError: (e) => {
          // Wi-Fi restarts on save, so the phone often drops before the answer arrives.
          if (isRouterError(e, 'timeout') || isRouterError(e, 'unreachable')) {
            snackbar.show('Your phone lost the Wi-Fi. The change was probably saved: reconnect with the new details.');
          } else {
            setErrors({ form: userMessage(e) });
          }
        },
      },
    );
  };

  // Logged out (also the idle / background timeout): forget every secret right away,
  // not only when the screen closes.
  if (status !== 'logged_in' && (password !== null || newPassword !== '' || confirm !== '')) {
    setPassword(null);
    setShowPassword(false);
    setShowQr(false);
    setNewPassword('');
    setConfirm('');
  }

  if (status !== 'logged_in') {
    return (
      <SubScreen title="Wi-Fi" fallback="/router">
        <Card>
          <LoginRequired message="Log in to see and change your Wi-Fi name and password." />
        </Card>
      </SubScreen>
    );
  }

  return (
    <SubScreen title="Wi-Fi" fallback="/router">
      <Card title="Your Wi-Fi">
        {n ? (
          <View style={styles.info}>
            <InfoRow label="Name" value={n.ssid} />
            <InfoRow label="Security" value={n.security.replace('-PSK', '')} />
            <InfoRow label="Visible to others" value={n.hidden ? 'No (hidden)' : 'Yes'} />
            <View style={styles.infoRow}>
              <AppText variant="body" color={colors.textSecondary}>
                Password
              </AppText>
              <AppText variant="body" style={styles.infoValue} selectable={false} numberOfLines={1}>
                {showPassword && password !== null ? password : '••••••••'}
              </AppText>
            </View>
          </View>
        ) : network.isError ? (
          <AppText variant="body" color={colors.textSecondary}>
            {userMessage(network.error)}
          </AppText>
        ) : (
          <Skeleton height={96} />
        )}
        <Button
          label={showPassword ? 'Hide password' : 'Show password'}
          variant="secondary"
          icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
          loading={revealing && !showQr}
          disabled={!n}
          onPress={() => void toggleShowPassword()}
        />
      </Card>

      <Card title="Share with guests">
        {showQr && n && password !== null ? (
          <View style={styles.qr}>
            <QrCode
              value={wifiQrPayload(n.ssid, password, n.security, n.hidden)}
              size={sizes.qrCode}
              label={`QR code to join ${n.ssid}`}
            />
            <AppText variant="caption" color={colors.textSecondary} style={styles.center}>
              Guests open their phone camera and point it at this code to join your Wi-Fi.
            </AppText>
          </View>
        ) : (
          <AppText variant="body" color={colors.textSecondary}>
            Show a QR code that guests can scan to join without typing the password.
          </AppText>
        )}
        <Button
          label={showQr ? 'Hide QR code' : 'Show QR code'}
          variant="secondary"
          icon="qr-code-outline"
          loading={revealing && !showPassword}
          disabled={!n}
          onPress={() => void toggleQr()}
        />
      </Card>

      <Card title="Change Wi-Fi">
        <Input
          label="Wi-Fi name"
          value={ssid}
          onChangeText={(v) => {
            setSsid(v);
            setErrors({});
          }}
          maxLength={32}
          editable={!!n && !save.isPending}
          error={errors.ssid}
        />
        <Input
          label="New password (leave empty to keep the current one)"
          value={newPassword}
          onChangeText={(v) => {
            setNewPassword(v);
            setErrors({});
          }}
          secret
          maxLength={63}
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!!n && !save.isPending}
          error={errors.password}
        />
        {newPassword !== '' && (
          <Input
            label="Confirm new password"
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              setErrors({});
            }}
            secret
            maxLength={63}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!save.isPending}
            error={errors.confirm}
          />
        )}
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <AppText variant="body">Hide network</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {"Hidden Wi-Fi doesn't appear in lists. People must type the name to join."}
            </AppText>
          </View>
          <Switch
            value={hidden}
            onValueChange={setHidden}
            disabled={!n || save.isPending}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
            accessibilityLabel="Hide network"
          />
        </View>
        {errors.form ? (
          <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
            {errors.form}
          </AppText>
        ) : null}
        <Button
          label="Save changes"
          loading={save.isPending}
          loadingLabel="Saving…"
          disabled={!changed}
          onPress={check}
        />
        <AppText variant="caption" color={colors.textSecondary}>
          Saving restarts the Wi-Fi. All Wi-Fi devices disconnect for a moment and must reconnect
          {newPassword ? ' with the new password' : ''}. Devices on a cable stay connected.
        </AppText>
      </Card>

      <ConfirmDialog
        visible={confirming}
        title="Change Wi-Fi?"
        message={
          newPassword
            ? 'Your phone will disconnect. Reconnect using the new password.'
            : 'Your phone will disconnect for a moment. Reconnect to the Wi-Fi afterwards.'
        }
        confirmLabel="Save"
        onCancel={() => setConfirming(false)}
        onConfirm={() => void submit()}
      />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  info: { gap: space.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  infoValue: { flexShrink: 1, textAlign: 'right' },
  qr: { alignItems: 'center', gap: space.md },
  center: { textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
