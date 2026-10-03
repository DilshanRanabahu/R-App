import { router, type Href } from 'expo-router';

import type { Host } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ListGroup } from '@/components/ListGroup';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { EmptyState, LoginRequired, Skeleton } from '@/components/States';
import { StatusChip } from '@/components/StatusChip';
import { useBlockList, useHosts } from '@/hooks/router';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { usePhoneIp } from '@/hooks/usePhoneIp';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { useAuth } from '@/state/AuthProvider';
import { markKnown, useDevicePrefs } from '@/state/devicePrefs';
import { useSnackbar } from '@/state/SnackbarProvider';
import { colors } from '@/theme';
import {
  CONNECTION_LABEL,
  deviceIcon,
  deviceTitle,
  groupDevices,
  isThisPhone,
  macToParam,
  type DevicePrefsMap,
} from '@/utils/devices';
import { formatDuration } from '@/utils/format';
import { lookupVendor } from '@/utils/vendor';

function DeviceRow({
  host,
  prefs,
  phoneIp,
  tag,
  divider,
}: {
  host: Host;
  prefs: DevicePrefsMap;
  phoneIp: string | null;
  tag?: 'new' | 'blocked';
  divider: boolean;
}) {
  const own = prefs[host.mac];
  const thisPhone = isThisPhone(host, phoneIp);
  const subtitle =
    tag === 'blocked'
      ? [lookupVendor(host.mac), "Can't use your Wi-Fi"]
      : host.active
        ? [host.ip, CONNECTION_LABEL[host.connection], host.connectedSeconds > 0 ? formatDuration(host.connectedSeconds) : null]
        : [lookupVendor(host.mac), host.connection === 'unknown' ? null : CONNECTION_LABEL[host.connection], 'Not connected'];
  return (
    <ListRow
      icon={deviceIcon(host, own, thisPhone)}
      title={deviceTitle(host, own)}
      subtitle={subtitle.filter(Boolean).join(' · ')}
      right={
        thisPhone ? (
          <StatusChip tone="primary" label="This phone" dot={false} />
        ) : tag === 'blocked' ? (
          <StatusChip tone="danger" label="Blocked" dot={false} />
        ) : tag === 'new' ? (
          <StatusChip tone="warning" label="New" dot={false} />
        ) : undefined
      }
      // Without a MAC there is nothing to key details on.
      onPress={host.mac ? () => router.push(`/device/${macToParam(host.mac)}` as Href) : undefined}
      accessibilityHint="Opens device details"
      chevron
      muted={!host.active || tag === 'blocked'}
      divider={divider}
    />
  );
}

export default function DevicesScreen() {
  const focused = useScreenFocus();
  const { status } = useAuth();
  const hosts = useHosts(focused);
  const blockList = useBlockList(focused);
  const phoneIp = usePhoneIp();
  const { prefs, loaded } = useDevicePrefs();
  const snackbar = useSnackbar();
  const { refreshing, onRefresh } = useManualRefresh(() => [hosts.refetch(), blockList.refetch()]);

  if (status !== 'logged_in') {
    return (
      <Screen title="Devices">
        <Card>
          <LoginRequired message="Log in to see and manage the devices on your network." />
        </Card>
      </Screen>
    );
  }

  if (!hosts.data || !loaded) {
    return (
      <Screen title="Devices" refreshing={refreshing} onRefresh={onRefresh}>
        <Card>
          {hosts.isError ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Couldn't load devices"
              message="Check that your phone is on the router's Wi-Fi."
              actionLabel="Retry"
              onAction={() => void hosts.refetch()}
            />
          ) : (
            <>
              <Skeleton />
              <Skeleton width="70%" />
              <Skeleton width="85%" />
            </>
          )}
        </Card>
      </Screen>
    );
  }

  // The list is only enforced while the router's filter is in block mode.
  const enforced = blockList.data?.mode === 'block' ? blockList.data.blocked : [];
  const { blocked, fresh, online, offline } = groupDevices(hosts.data, prefs, phoneIp, enforced);
  const onlineCount = fresh.length + online.length;
  const total = onlineCount + offline.length + blocked.length;
  const rows = (list: Host[], tag?: 'new' | 'blocked') =>
    list.map((h, i) => (
      <DeviceRow key={h.mac || `${h.ip}-${i}`} host={h} prefs={prefs} phoneIp={phoneIp} tag={tag} divider={i > 0} />
    ));

  const markAll = () => {
    const macs = fresh.map((h) => h.mac).filter(Boolean);
    void markKnown(macs).then(() =>
      snackbar.show(macs.length === 1 ? '1 device marked as known.' : `${macs.length} devices marked as known.`),
    );
  };

  return (
    <Screen
      title="Devices"
      right={
        <AppText variant="label" color={colors.textSecondary} numeric>
          {onlineCount} online
        </AppText>
      }
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {total === 0 && (
        <Card>
          <EmptyState icon="wifi-outline" title="No devices connected" />
        </Card>
      )}

      {fresh.length > 0 && (
        <>
          <ListGroup title={fresh.length === 1 ? '1 new device' : `${fresh.length} new devices`}>{rows(fresh, 'new')}</ListGroup>
          <AppText variant="caption" color={colors.textSecondary}>
            Connected, but not marked as known yet. Tap a device to check it. If you don&apos;t recognise one, change
            your Wi-Fi password.
          </AppText>
          <Button label="Mark all as known" variant="secondary" icon="checkmark-done-outline" onPress={markAll} />
        </>
      )}

      {online.length > 0 && <ListGroup title="Connected">{rows(online)}</ListGroup>}
      {blocked.length > 0 && <ListGroup title="Blocked">{rows(blocked, 'blocked')}</ListGroup>}
      {offline.length > 0 && <ListGroup title="Not connected">{rows(offline)}</ListGroup>}

      {total > 0 && (
        <AppText variant="caption" color={colors.textMuted}>
          Tap a device to name it, block it or see its details.
        </AppText>
      )}
    </Screen>
  );
}
