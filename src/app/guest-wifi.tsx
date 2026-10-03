import { usePreventScreenCapture } from 'expo-screen-capture';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { isRouterError, userMessage } from '@/api/errors';
import type { GuestOffTime } from '@/api/types';
import { validateSsid, validateWifiKey } from '@/api/validate';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips } from '@/components/ChoiceChips';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Input } from '@/components/Input';
import { QrCode } from '@/components/QrCode';
import { EmptyState, LoginRequired, Skeleton } from '@/components/States';
import { StatusChip } from '@/components/StatusChip';
import { SubScreen } from '@/components/SubScreen';
import {
  useExtendGuestTime,
  useGuestNetwork,
  useRevealGuestPassword,
  useSaveGuestNetwork,
  useSetGuestEnabled,
} from '@/hooks/router';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { NO_LOCK_MESSAGE, requireDeviceAuth } from '@/security/deviceAuth';
import { useAuth } from '@/state/AuthProvider';
import { useSnackbar } from '@/state/SnackbarProvider';
import { colors, sizes, space } from '@/theme';
import { formatDuration } from '@/utils/format';
import { wifiQrPayload } from '@/utils/wifiQr';

const SECURITY = [
  { id: 'password', label: 'Password', icon: 'lock-closed-outline' },
  { id: 'open', label: 'No password', icon: 'lock-open-outline' },
] as const;

const OFF_TIMES = [
  { id: '4', label: '4 hours', icon: 'time-outline' },
  { id: '24', label: '1 day', icon: 'today-outline' },
  { id: '0', label: 'Never', icon: 'infinite-outline' },
] as const;

const OFF_TIME_TEXT: Record<GuestOffTime, string> = {
  '0': 'Stays on until you turn it off',
  '4': 'Turns itself off after 4 hours',
  '24': 'Turns itself off after 1 day',
};

const LOST_WIFI = 'Your phone lost the Wi-Fi for a moment. The change was probably saved: reconnect and check.';

type Errors = { ssid?: string; password?: string; form?: string };
type Confirm = { kind: 'switch'; on: boolean } | { kind: 'save' };

/**
 * Guest Wi-Fi (the router's second network): on/off, name, password or open, automatic
 * switch-off and a QR code for visitors. Every change restarts the Wi-Fi, so it is
 * confirmed and needs fingerprint/PIN (AGENTS.md §8.8). Screenshot-blocked.
 */
export default function GuestWifiScreen() {
  usePreventScreenCapture();

  const focused = useScreenFocus();
  const { status } = useAuth();
  const snackbar = useSnackbar();
  const guest = useGuestNetwork(focused);
  const setEnabled = useSetGuestEnabled();
  const save = useSaveGuestNetwork();
  const extend = useExtendGuestTime();
  const reveal = useRevealGuestPassword();

  const [ssid, setSsid] = useState('');
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [offTime, setOffTime] = useState<GuestOffTime>('4');
  const [errors, setErrors] = useState<Errors>({});
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [qrPassword, setQrPassword] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const g = guest.data;
  // Fill the form whenever fresh settings arrive (first load, after saving).
  const [formFor, setFormFor] = useState<typeof g>(undefined);
  if (g && g !== formFor && !save.isPending) {
    const first = !formFor;
    setFormFor(g);
    if (first || (g.ssid !== formFor?.ssid || g.open !== formFor?.open || g.offTime !== formFor?.offTime)) {
      setSsid(g.ssid);
      setOpen(g.open);
      setOffTime(g.offTime);
    }
  }

  // Logged out (also the idle / background timeout): drop the secrets right away.
  if (status !== 'logged_in' && (qrPassword !== null || password !== '' || showQr)) {
    setQrPassword(null);
    setPassword('');
    setShowQr(false);
  }

  if (status !== 'logged_in') {
    return (
      <SubScreen title="Guest Wi-Fi" fallback="/router">
        <Card>
          <LoginRequired message="Log in to set up a separate Wi-Fi for visitors." />
        </Card>
      </SubScreen>
    );
  }

  if (!g) {
    return (
      <SubScreen title="Guest Wi-Fi" fallback="/router">
        <Card>
          {guest.isError ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Couldn't load guest Wi-Fi"
              message={userMessage(guest.error)}
              actionLabel="Retry"
              onAction={() => void guest.refetch()}
            />
          ) : guest.data === null ? (
            <EmptyState icon="wifi-outline" title="No guest Wi-Fi" message="Your router doesn't offer a guest network." />
          ) : (
            <>
              <Skeleton height={sizes.touchTarget} />
              <Skeleton width="70%" />
            </>
          )}
        </Card>
      </SubScreen>
    );
  }

  const trimmed = ssid.trim();
  const busy = setEnabled.isPending || save.isPending;
  const changed = trimmed !== g.ssid || open !== g.open || offTime !== g.offTime || (!open && password !== '');
  // Switching from open to a password needs one typed in.
  const passwordRequired = !open && g.open;

  const onWifiError = (e: unknown) => {
    if (isRouterError(e, 'timeout') || isRouterError(e, 'unreachable')) snackbar.show(LOST_WIFI);
    else snackbar.show(userMessage(e));
  };

  const check = () => {
    const found: Errors = {};
    const ssidError = validateSsid(trimmed);
    if (ssidError) found.ssid = ssidError;
    if (!open && (password !== '' || passwordRequired)) {
      const keyError = validateWifiKey(password);
      if (keyError) found.password = keyError;
    }
    setErrors(found);
    if (Object.keys(found).length === 0) setConfirm({ kind: 'save' });
  };

  const run = async () => {
    const action = confirm;
    setConfirm(null);
    if (!action) return;
    const auth = await requireDeviceAuth('Confirm guest Wi-Fi change');
    if (auth === 'no_lock') return snackbar.show(NO_LOCK_MESSAGE);
    if (auth !== 'ok') return;

    if (action.kind === 'switch') {
      setEnabled.mutate(action.on, {
        onSuccess: () => snackbar.show(action.on ? 'Guest Wi-Fi is on.' : 'Guest Wi-Fi is off.'),
        onError: onWifiError,
      });
      return;
    }
    save.mutate(
      { ssid: trimmed, open, newPassword: !open && password !== '' ? password : null, offTime },
      {
        onSuccess: () => {
          snackbar.show('Guest Wi-Fi saved.');
          setPassword('');
          setQrPassword(null);
          setShowQr(false);
        },
        onError: onWifiError,
      },
    );
  };

  const toggleQr = async () => {
    if (showQr) return setShowQr(false);
    if (g.open || qrPassword !== null) return setShowQr(true);
    const auth = await requireDeviceAuth('Show guest Wi-Fi QR code');
    if (auth === 'no_lock') return snackbar.show(NO_LOCK_MESSAGE);
    if (auth !== 'ok') return;
    setRevealing(true);
    try {
      setQrPassword(await reveal());
      setShowQr(true);
    } catch (e) {
      snackbar.show(userMessage(e));
    } finally {
      setRevealing(false);
    }
  };

  const timed = g.enabled && g.offTime !== '0' && g.remainSeconds > 0;

  return (
    <SubScreen title="Guest Wi-Fi" fallback="/router">
      <Card>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <AppText variant="heading" numberOfLines={1}>
              {g.ssid || 'Guest Wi-Fi'}
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {setEnabled.isPending
                ? 'Updating… Wi-Fi is restarting'
                : !g.enabled
                  ? 'Off'
                  : timed
                    ? `On · turns off in ${formatDuration(g.remainSeconds)}`
                    : 'On'}
            </AppText>
          </View>
          <Switch
            value={g.enabled}
            disabled={busy}
            onValueChange={(on) => setConfirm({ kind: 'switch', on })}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
            accessibilityLabel="Guest Wi-Fi"
          />
        </View>
        <View style={styles.chips}>
          <StatusChip
            tone={g.open ? 'warning' : 'success'}
            label={g.open ? 'No password' : 'Password protected'}
            dot={false}
          />
        </View>
        <AppText variant="caption" color={colors.textMuted}>
          A separate network for visitors, so you never share your main Wi-Fi password.
        </AppText>
        {timed && (
          <Button
            label={`Keep on ${g.extendMinutes} more minutes`}
            variant="secondary"
            icon="time-outline"
            loading={extend.isPending}
            loadingLabel="Extending…"
            onPress={() =>
              extend.mutate(g.extendMinutes, {
                onSuccess: () => snackbar.show(`Guest Wi-Fi stays on ${g.extendMinutes} minutes longer.`),
                onError: (e) => snackbar.show(userMessage(e)),
              })
            }
          />
        )}
      </Card>

      <Card title="Share with guests">
        {showQr ? (
          <View style={styles.qr}>
            <QrCode
              value={wifiQrPayload(g.ssid, qrPassword ?? '', g.open ? 'OPEN' : 'WPA2-PSK', false)}
              size={sizes.qrCode}
              label={`QR code to join ${g.ssid}`}
            />
            <AppText variant="caption" color={colors.textSecondary} style={styles.center}>
              {g.enabled
                ? 'Guests scan this with their phone camera to join.'
                : 'Guest Wi-Fi is off. Turn it on before guests scan this.'}
            </AppText>
          </View>
        ) : (
          <AppText variant="body" color={colors.textSecondary}>
            Show a QR code your guests can scan to join, without typing anything.
          </AppText>
        )}
        <Button
          label={showQr ? 'Hide QR code' : 'Show QR code'}
          variant="secondary"
          icon="qr-code-outline"
          loading={revealing}
          loadingLabel="Reading…"
          onPress={() => void toggleQr()}
        />
      </Card>

      <Card title="Settings">
        <Input
          label="Name"
          value={ssid}
          onChangeText={(v) => {
            setSsid(v);
            setErrors({});
          }}
          maxLength={32}
          editable={!busy}
          error={errors.ssid}
        />
        <ChoiceChips
          label="Security"
          choices={SECURITY}
          value={open ? 'open' : 'password'}
          onChange={(id) => {
            setOpen(id === 'open');
            setErrors({});
          }}
        />
        {open ? (
          <AppText variant="caption" color={colors.warning}>
            Without a password, anyone nearby can join and use your data.
          </AppText>
        ) : (
          <Input
            label={passwordRequired ? 'Password' : 'New password'}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setErrors({});
            }}
            secret
            placeholder={passwordRequired ? '8 or more characters' : 'Leave empty to keep the current one'}
            autoComplete="off"
            editable={!busy}
            error={errors.password}
          />
        )}
        <ChoiceChips label="Turn off automatically" choices={OFF_TIMES} value={offTime} onChange={setOffTime} />
        <AppText variant="caption" color={colors.textMuted}>
          {OFF_TIME_TEXT[offTime]}.
        </AppText>
        {errors.form ? (
          <AppText variant="caption" color={colors.danger}>
            {errors.form}
          </AppText>
        ) : null}
        <Button
          label="Save changes"
          loading={save.isPending}
          loadingLabel="Saving…"
          disabled={!changed || setEnabled.isPending}
          onPress={check}
        />
        <AppText variant="caption" color={colors.textMuted}>
          Saving restarts the Wi-Fi: phones drop for a few seconds, then reconnect by themselves.
        </AppText>
      </Card>

      <ConfirmDialog
        visible={confirm !== null}
        title={
          confirm?.kind === 'switch'
            ? confirm.on
              ? 'Turn on guest Wi-Fi?'
              : 'Turn off guest Wi-Fi?'
            : 'Save guest Wi-Fi?'
        }
        message={
          confirm?.kind === 'switch' && !confirm.on
            ? 'Guests are disconnected. The Wi-Fi restarts, so your phone also drops for a few seconds.'
            : confirm?.kind === 'switch' && g.open
              ? 'It has no password, so anyone nearby can join. The Wi-Fi restarts, so your phone drops for a few seconds.'
              : 'The Wi-Fi restarts, so your phone drops for a few seconds and then reconnects.'
        }
        confirmLabel={confirm?.kind === 'switch' ? (confirm.on ? 'Turn on' : 'Turn off') : 'Save'}
        onConfirm={() => void run()}
        onCancel={() => setConfirm(null)}
      />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  qr: { alignItems: 'center', gap: space.md },
  center: { textAlign: 'center' },
});
