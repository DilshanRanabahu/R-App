import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { userMessage } from '@/api/errors';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { SignalBars } from '@/components/SignalBars';
import { LoginRequired, Skeleton } from '@/components/States';
import { StatusChip } from '@/components/StatusChip';
import {
  useHosts,
  useMobileData,
  useOperator,
  useSetMobileData,
  useSignal,
  useSimReady,
  useStatus,
  useTraffic,
} from '@/hooks/router';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { useAuth } from '@/state/AuthProvider';
import { useSnackbar } from '@/state/SnackbarProvider';
import { colors, sizes, space, type Tone } from '@/theme';
import { formatBytes, formatDuration, formatRate, joinUnit, type ValueWithUnit } from '@/utils/format';
import { RATING_LABEL, overallRating } from '@/utils/signal';

function BigStat({ label, icon, value, color }: {
  label: string;
  icon: 'arrow-down' | 'arrow-up';
  value: ValueWithUnit | null;
  color: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statLabel}>
        <Ionicons name={icon} size={sizes.iconSmall} color={color} />
        <AppText variant="label" color={colors.textSecondary}>
          {label}
        </AppText>
      </View>
      {value ? (
        <View style={styles.valueRow}>
          <AppText variant="display" numeric>
            {value.value}
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {value.unit}
          </AppText>
        </View>
      ) : (
        <Skeleton width={96} height={38} />
      )}
    </View>
  );
}

export default function HomeScreen() {
  const focused = useScreenFocus();
  const { status: auth } = useAuth();
  const loggedIn = auth === 'logged_in';
  const snackbar = useSnackbar();

  const traffic = useTraffic(focused);
  const operator = useOperator(focused);
  const simReady = useSimReady();
  const status = useStatus(focused);
  const signal = useSignal(focused);
  const hosts = useHosts(focused);
  const mobileData = useMobileData();
  const setMobileData = useSetMobileData();
  const [confirmDataOff, setConfirmDataOff] = useState(false);

  const t = traffic.data;
  const connected = status.data
    ? status.data.connection === 'connected'
    : t
      ? t.connectSeconds > 0
      : undefined;
  const chip: { tone: Tone; label: string } =
    connected === undefined
      ? { tone: 'neutral', label: 'Checking' }
      : connected
        ? { tone: 'success', label: 'Online' }
        : { tone: 'danger', label: 'Offline' };

  const subtitleParts = [
    operator.data?.name,
    operator.data?.generation !== 'Unknown' ? operator.data?.generation : undefined,
    simReady.data === false ? 'SIM not ready' : undefined,
  ].filter(Boolean);

  const rating = signal.data ? overallRating(signal.data.rsrp, signal.data.sinr) : 'unknown';

  const toggleData = (next: boolean) => {
    if (!next) {
      setConfirmDataOff(true);
      return;
    }
    setMobileData.mutate(true, { onError: (e) => snackbar.show(userMessage(e)) });
  };

  const { refreshing, onRefresh } = useManualRefresh(() => [
    traffic.refetch(),
    operator.refetch(),
    ...(loggedIn ? [status.refetch(), signal.refetch(), hosts.refetch(), mobileData.refetch()] : []),
  ]);

  return (
    <Screen
      title="My Router"
      subtitle={subtitleParts.join(' · ') || ' '}
      right={<StatusChip tone={chip.tone} label={chip.label} />}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <Card>
        <View style={styles.statRow}>
          <BigStat label="Download" icon="arrow-down" color={colors.primary} value={t ? formatRate(t.downloadRate) : null} />
          <BigStat label="Upload" icon="arrow-up" color={colors.info} value={t ? formatRate(t.uploadRate) : null} />
        </View>
      </Card>

      <Card title="Data used">
        {t ? (
          <>
            <View style={styles.valueRow}>
              <AppText variant="display" numeric>
                {formatBytes(t.sessionDownload + t.sessionUpload).value}
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {formatBytes(t.sessionDownload + t.sessionUpload).unit} this session
              </AppText>
            </View>
            <AppText variant="caption" color={colors.textSecondary} numeric>
              Connected {formatDuration(t.connectSeconds)} · Total{' '}
              {joinUnit(formatBytes(t.totalDownload + t.totalUpload))}
            </AppText>
          </>
        ) : (
          <Skeleton height={38} width={140} />
        )}
      </Card>

      <Card
        title="Signal"
        onPress={loggedIn ? () => router.navigate('/signal') : undefined}
        accessibilityLabel={`Signal ${RATING_LABEL[rating]}. Open signal details`}
        right={
          loggedIn && signal.data ? (
            <View style={styles.inline}>
              <SignalBars rating={rating} />
              <AppText variant="label">{RATING_LABEL[rating]}</AppText>
              <Ionicons name="chevron-forward" size={sizes.iconSmall} color={colors.textMuted} />
            </View>
          ) : undefined
        }
      >
        {!loggedIn ? (
          <LoginRequired message="Log in to see signal strength." />
        ) : signal.data ? (
          <AppText variant="caption" color={colors.textSecondary} numeric>
            RSRP {signal.data.rsrp ?? '–'} dBm · SINR {signal.data.sinr ?? '–'} dB
          </AppText>
        ) : (
          <Skeleton width={180} />
        )}
      </Card>

      {loggedIn && (
        <View style={styles.quickRow}>
          <Card style={styles.quick}>
            <View style={styles.quickInner}>
              <AppText variant="label" color={colors.textSecondary} style={styles.flex}>
                Mobile data
              </AppText>
              <Switch
                value={mobileData.data ?? false}
                disabled={mobileData.data === undefined || setMobileData.isPending}
                onValueChange={toggleData}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.surface}
                accessibilityLabel="Mobile data"
              />
            </View>
            {setMobileData.isPending && (
              <AppText variant="caption" color={colors.textMuted}>
                Updating…
              </AppText>
            )}
          </Card>
          <Card
            style={styles.quick}
            onPress={() => router.navigate('/devices')}
            accessibilityLabel="Connected devices"
          >
            <View style={styles.quickInner}>
              <AppText variant="label" color={colors.textSecondary} style={styles.flex} numeric>
                {hosts.data
                  ? `${hosts.data.length} ${hosts.data.length === 1 ? 'device' : 'devices'}`
                  : 'Devices'}
              </AppText>
              <Ionicons name="chevron-forward" size={sizes.iconSmall} color={colors.textMuted} />
            </View>
          </Card>
        </View>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: space.lg },
  stat: { flex: 1, gap: space.xs },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  quickRow: { flexDirection: 'row', gap: space.md },
  quick: { flex: 1, paddingVertical: space.md },
  quickInner: { flexDirection: 'row', alignItems: 'center', minHeight: sizes.touchTarget - space.md },
  flex: { flex: 1 },
});
