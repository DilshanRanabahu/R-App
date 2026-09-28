import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

import type { Host, HostConnection } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { EmptyState, LoginRequired, Skeleton } from '@/components/States';
import { StatusChip } from '@/components/StatusChip';
import { useHosts } from '@/hooks/router';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { useAuth } from '@/state/AuthProvider';
import { colors } from '@/theme';
import { formatDuration } from '@/utils/format';

const CONNECTION_LABEL: Record<HostConnection, string> = {
  wifi: 'Wi-Fi',
  cable: 'Cable',
  unknown: 'Connected',
};

function usePhoneIp(): string | null {
  const [ip, setIp] = useState<string | null>(null);
  useEffect(() => {
    Network.getIpAddressAsync()
      .then(setIp)
      .catch(() => setIp(null));
  }, []);
  return ip;
}

export default function DevicesScreen() {
  const focused = useScreenFocus();
  const { status } = useAuth();
  const hosts = useHosts(focused);
  const phoneIp = usePhoneIp();
  const { refreshing, onRefresh } = useManualRefresh(() => [hosts.refetch()]);

  if (status !== 'logged_in') {
    return (
      <Screen title="Devices">
        <Card>
          <LoginRequired message="Log in to see the devices using your Wi-Fi." />
        </Card>
      </Screen>
    );
  }

  // This phone first, then longest connected.
  const list: Host[] = [...(hosts.data ?? [])].sort((a, b) => {
    if (a.ip === phoneIp) return -1;
    if (b.ip === phoneIp) return 1;
    return b.connectedSeconds - a.connectedSeconds;
  });

  return (
    <Screen
      title="Devices"
      right={
        hosts.data ? (
          <AppText variant="label" color={colors.textSecondary} numeric>
            {hosts.data.length} online
          </AppText>
        ) : undefined
      }
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <Card>
        {!hosts.data ? (
          <>
            <Skeleton />
            <Skeleton width="70%" />
          </>
        ) : list.length === 0 ? (
          <EmptyState icon="wifi-outline" title="No devices connected" />
        ) : (
          list.map((h, i) => {
            const isPhone = h.ip === phoneIp;
            return (
              <ListRow
                key={h.mac || `${h.ip}-${i}`}
                icon={
                  isPhone
                    ? 'phone-portrait-outline'
                    : h.connection === 'cable'
                      ? 'desktop-outline'
                      : 'wifi-outline'
                }
                title={h.name}
                subtitle={[
                  h.ip,
                  CONNECTION_LABEL[h.connection],
                  h.connectedSeconds > 0 ? formatDuration(h.connectedSeconds) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                right={isPhone ? <StatusChip tone="primary" label="This phone" dot={false} /> : undefined}
                divider={i > 0}
              />
            );
          })
        )}
      </Card>
      <AppText variant="caption" color={colors.textMuted}>
        Shows Wi-Fi and cable devices. Device details, nicknames and blocking come in the next update.
      </AppText>
    </Screen>
  );
}
