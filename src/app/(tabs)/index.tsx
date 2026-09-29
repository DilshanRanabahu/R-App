import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { SpeedChart } from '@/components/SpeedChart';
import { Skeleton } from '@/components/States';
import { StatusChip } from '@/components/StatusChip';
import {
  useConnectionChip,
  useDataPlan,
  useMonthUsage,
  useOperator,
  useSimReady,
  useStatus,
  useTraffic,
} from '@/hooks/router';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { useSpeedHistory } from '@/hooks/useSpeedHistory';
import { useAuth } from '@/state/AuthProvider';
import { colors, sizes, space, toneColors } from '@/theme';
import { formatBytes, formatDuration, formatRate, joinUnit, type ValueWithUnit } from '@/utils/format';
import { usageNote, usageTone } from '@/utils/usage';

function BigStat({ label, icon, value, color }: {
  label: string;
  icon?: 'arrow-down' | 'arrow-up';
  value: ValueWithUnit | null;
  color?: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statLabel}>
        {icon && <Ionicons name={icon} size={sizes.iconSmall} color={color} />}
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

/** "↓ 1.3 GB" in the same colours as the speed chart. */
function Direction({ icon, color, name, bytes }: {
  icon: 'arrow-down' | 'arrow-up';
  color: string;
  name: string;
  bytes: number;
}) {
  const value = joinUnit(formatBytes(bytes));
  return (
    <View style={styles.direction} accessible accessibilityLabel={`${name} ${value}`}>
      <Ionicons name={icon} size={sizes.iconSmall} color={color} />
      <AppText variant="label" numeric>
        {value}
      </AppText>
    </View>
  );
}

export default function HomeScreen() {
  const focused = useScreenFocus();
  const { status: auth } = useAuth();
  const loggedIn = auth === 'logged_in';

  const traffic = useTraffic(focused);
  const speedHistory = useSpeedHistory(traffic.data, traffic.dataUpdatedAt);
  const monthUsage = useMonthUsage(focused);
  const dataPlan = useDataPlan(focused);
  const operator = useOperator(focused);
  const simReady = useSimReady();
  const status = useStatus(focused);
  const chip = useConnectionChip(focused);

  const t = traffic.data;
  const subtitleParts = [
    operator.data?.name,
    operator.data?.generation !== 'Unknown' ? operator.data?.generation : undefined,
    simReady.data === false ? 'SIM not ready' : undefined,
  ].filter(Boolean);

  const month = monthUsage.data;
  const plan = dataPlan.data;
  const monthUsed = month ? month.download + month.upload : 0;
  const planFraction = plan?.limitBytes ? monthUsed / plan.limitBytes : null;
  const planTone = planFraction === null ? 'primary' : usageTone(planFraction);
  // Status also in words, never by colour alone (DESIGN.md §3).
  const planWords =
    planFraction === null ? '' : planFraction > 1 ? ' · over your plan' : planFraction >= 0.8 ? ' · almost used up' : '';

  const { refreshing, onRefresh } = useManualRefresh(() => [
    traffic.refetch(),
    monthUsage.refetch(),
    dataPlan.refetch(),
    operator.refetch(),
    ...(loggedIn ? [status.refetch()] : []),
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
        <SpeedChart samples={speedHistory} />
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
            <View style={styles.directions}>
              <Direction icon="arrow-down" color={colors.primary} name="Downloaded" bytes={t.sessionDownload} />
              <Direction icon="arrow-up" color={colors.info} name="Uploaded" bytes={t.sessionUpload} />
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
        title="Monthly usage"
        right={
          month && plan ? (
            <AppText variant="caption" color={colors.textMuted}>
              {usageNote(plan.startDay, month.lastCleared, new Date())}
            </AppText>
          ) : undefined
        }
      >
        <View style={styles.statRow}>
          <BigStat label="Today" value={month ? formatBytes(month.today) : null} />
          <BigStat label="This month" value={month ? formatBytes(monthUsed) : null} />
        </View>
        {month && plan ? (
          plan.limitBytes && planFraction !== null ? (
            <View style={styles.plan}>
              <ProgressBar value={planFraction} color={toneColors(planTone).fg} />
              <AppText
                variant="caption"
                color={planTone === 'primary' ? colors.textSecondary : toneColors(planTone).fg}
                numeric
              >
                {Math.round(planFraction * 100)} % of your {joinUnit(formatBytes(plan.limitBytes))} plan
                {planWords}
              </AppText>
            </View>
          ) : (
            <AppText variant="caption" color={colors.textMuted}>
              No monthly data plan is set on the router.
            </AppText>
          )
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: space.lg },
  stat: { flex: 1, gap: space.xs },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  directions: { flexDirection: 'row', gap: space.lg },
  direction: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  plan: { gap: space.sm },
});
