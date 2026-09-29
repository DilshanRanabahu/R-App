import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { userMessage } from '@/api/errors';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ListGroup } from '@/components/ListGroup';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { LoginRequired, Skeleton } from '@/components/States';
import { StatusChip } from '@/components/StatusChip';
import {
  useConnectionChip,
  useMobileData,
  useReboot,
  useRouterDetails,
  useRouterInfo,
  useSetMobileData,
} from '@/hooks/router';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { NO_LOCK_MESSAGE, requireDeviceAuth } from '@/security/deviceAuth';
import { useAuth } from '@/state/AuthProvider';
import { markRebootRequested } from '@/state/rebootGate';
import { useSnackbar } from '@/state/SnackbarProvider';
import { colors, space } from '@/theme';
import { formatDuration } from '@/utils/format';

/** Router tab: everything that changes the router. App options stay in Settings. */
export default function RouterScreen() {
  const focused = useScreenFocus();
  const { status } = useAuth();
  const loggedIn = status === 'logged_in';
  const snackbar = useSnackbar();

  const info = useRouterInfo();
  const details = useRouterDetails(focused);
  const chip = useConnectionChip(focused);
  const mobileData = useMobileData();
  const setMobileData = useSetMobileData();
  const reboot = useReboot();
  const [confirmDataOff, setConfirmDataOff] = useState(false);
  const [confirmReboot, setConfirmReboot] = useState(false);

  // Turning data off cuts every device's internet, so only that direction confirms (DESIGN.md §11).
  const toggleData = (next: boolean) => {
    if (!next) return setConfirmDataOff(true);
    setMobileData.mutate(true, { onError: (e) => snackbar.show(userMessage(e)) });
  };

  const doReboot = async () => {
    setConfirmReboot(false);
    const auth = await requireDeviceAuth('Confirm router reboot');
    if (auth === 'no_lock') return snackbar.show(NO_LOCK_MESSAGE);
    if (auth !== 'ok') return;
    reboot.mutate(undefined, {
      onSuccess: () => {
        markRebootRequested();
        router.push('/rebooting');
      },
      onError: (e) => snackbar.show(userMessage(e)),
    });
  };

  const { refreshing, onRefresh } = useManualRefresh(() => [
    info.refetch(),
    ...(loggedIn ? [details.refetch(), mobileData.refetch()] : []),
  ]);

  const d = details.data;
  const facts = [
    d?.uptimeSeconds != null ? `Running for ${formatDuration(d.uptimeSeconds)}` : null,
    d?.firmware ? `Firmware ${d.firmware}` : null,
  ].filter(Boolean);

  return (
    <Screen title="Router" refreshing={refreshing} onRefresh={onRefresh}>
      <Card>
        <View style={styles.statusRow}>
          <View style={styles.flex}>
            {info.data ? (
              <>
                <AppText variant="heading" numberOfLines={1}>
                  {info.data.marketingName || info.data.deviceName}
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  {info.data.deviceName}
                </AppText>
              </>
            ) : (
              <Skeleton width={180} height={40} />
            )}
          </View>
          <StatusChip tone={chip.tone} label={chip.label} />
        </View>
        {loggedIn &&
          (facts.length > 0 ? (
            <AppText variant="caption" color={colors.textSecondary} numeric>
              {facts.join(' · ')}
            </AppText>
          ) : details.isPending ? (
            <Skeleton width={200} height={16} />
          ) : null)}
      </Card>

      {!loggedIn ? (
        <Card>
          <LoginRequired message="Log in to manage your router: Wi-Fi, mobile data, reboot and more." />
        </Card>
      ) : (
        <>
          <ListGroup title="Wi-Fi">
            <ListRow
              icon="wifi-outline"
              title="Wi-Fi name & password"
              subtitle="Show password, QR code for guests, change"
              onPress={() => router.push('/wifi')}
            />
          </ListGroup>

          <ListGroup title="Internet">
            <ListRow
              icon="swap-vertical-outline"
              title="Mobile data"
              subtitle={
                setMobileData.isPending
                  ? 'Updating…'
                  : mobileData.data === false
                    ? 'Off · no internet for any device'
                    : undefined
              }
              right={
                <Switch
                  value={mobileData.data ?? false}
                  disabled={mobileData.data === undefined || setMobileData.isPending}
                  onValueChange={toggleData}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.surface}
                  accessibilityLabel="Mobile data"
                />
              }
            />
          </ListGroup>

          <ListGroup title="Security">
            <ListRow
              icon="key-outline"
              title="Change admin password"
              onPress={() => router.push('/change-password')}
            />
          </ListGroup>

          <ListGroup title="Danger zone" danger>
            <ListRow
              icon="power"
              title={reboot.isPending ? 'Rebooting…' : 'Reboot router'}
              destructive
              onPress={reboot.isPending ? undefined : () => setConfirmReboot(true)}
            />
          </ListGroup>
        </>
      )}

      <ConfirmDialog
        visible={confirmDataOff}
        title="Turn off mobile data?"
        message="All devices will lose internet until you turn it back on."
        confirmLabel="Turn off"
        destructive
        onCancel={() => setConfirmDataOff(false)}
        onConfirm={() => {
          setConfirmDataOff(false);
          setMobileData.mutate(false, { onError: (e) => snackbar.show(userMessage(e)) });
        }}
      />

      <ConfirmDialog
        visible={confirmReboot}
        title="Reboot router?"
        message="Internet will be off for about 1–2 minutes."
        confirmLabel="Reboot"
        destructive
        onCancel={() => setConfirmReboot(false)}
        onConfirm={() => void doReboot()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
});
