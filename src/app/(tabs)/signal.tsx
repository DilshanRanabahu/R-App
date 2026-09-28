import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { SignalBars } from '@/components/SignalBars';
import { LoginRequired, Skeleton } from '@/components/States';
import { useSignal } from '@/hooks/router';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { useAuth } from '@/state/AuthProvider';
import { colors, space, toneColors } from '@/theme';
import {
  RATING_LABEL,
  RATING_SENTENCE,
  RATING_TONE,
  overallRating,
  rateRsrp,
  rateRsrq,
  rateSinr,
  type SignalRating,
} from '@/utils/signal';

// Bar fill ranges per metric (worst → best).
function fraction(value: number | null, min: number, max: number): number {
  if (value === null) return 0;
  return (value - min) / (max - min);
}

function MetricRow({ name, value, unit, rating, fill }: {
  name: string;
  value: number | null;
  unit: string;
  rating?: SignalRating;
  fill?: number;
}) {
  const tone = rating ? toneColors(RATING_TONE[rating]) : null;
  const spoken = `${name} ${value ?? 'unknown'} ${unit}${rating ? `, ${RATING_LABEL[rating]}` : ''}`;
  return (
    <View style={styles.metric} accessible accessibilityLabel={spoken}>
      <AppText variant="label" color={colors.textSecondary} style={styles.metricName}>
        {name}
      </AppText>
      <AppText variant="body" numeric style={styles.metricValue}>
        {value ?? '–'} <AppText variant="caption" color={colors.textMuted}>{unit}</AppText>
      </AppText>
      <View style={styles.metricBar}>
        {fill !== undefined && tone && <ProgressBar value={fill} color={tone.fg} />}
      </View>
      <AppText variant="label" color={tone?.fg ?? colors.textMuted} style={styles.metricRating}>
        {rating ? RATING_LABEL[rating] : ''}
      </AppText>
    </View>
  );
}

export default function SignalScreen() {
  const focused = useScreenFocus();
  const { status } = useAuth();
  const signal = useSignal(focused);
  const { refreshing, onRefresh } = useManualRefresh(() => [signal.refetch()]);

  if (status !== 'logged_in') {
    return (
      <Screen title="Signal">
        <Card>
          <LoginRequired message="Log in to see your 4G signal details." />
        </Card>
      </Screen>
    );
  }

  const s = signal.data;
  const rating = s ? overallRating(s.rsrp, s.sinr) : 'unknown';
  const tone = toneColors(RATING_TONE[rating]);

  return (
    <Screen title="Signal" refreshing={refreshing} onRefresh={onRefresh}>
      <Card>
        {s ? (
          <View style={styles.hero}>
            <SignalBars rating={rating} size={40} />
            <AppText variant="display" color={tone.fg}>
              {RATING_LABEL[rating]}
            </AppText>
            <AppText variant="body" color={colors.textSecondary} style={styles.center}>
              {RATING_SENTENCE[rating]}
            </AppText>
          </View>
        ) : (
          <View style={styles.hero}>
            <Skeleton width={120} height={40} />
            <Skeleton width={200} />
          </View>
        )}
      </Card>

      {s && (
        <Card>
          <MetricRow name="RSRP" value={s.rsrp} unit="dBm" rating={rateRsrp(s.rsrp)} fill={fraction(s.rsrp, -120, -70)} />
          <MetricRow name="SINR" value={s.sinr} unit="dB" rating={rateSinr(s.sinr)} fill={fraction(s.sinr, -5, 30)} />
          <MetricRow name="RSRQ" value={s.rsrq} unit="dB" rating={rateRsrq(s.rsrq)} fill={fraction(s.rsrq, -25, -5)} />
          <MetricRow name="RSSI" value={s.rssi} unit="dBm" />
        </Card>
      )}

      {s && (s.band || s.pci || s.cellId) ? (
        <Card>
          <AppText variant="caption" color={colors.textSecondary} numeric>
            {[s.band && `Band B${s.band}`, s.pci && `PCI ${s.pci}`, s.cellId && `Cell ${s.cellId}`]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </Card>
      ) : null}

      <Card title="What do these numbers mean?">
        <AppText variant="caption" color={colors.textSecondary}>
          RSRP is signal strength (closer to −70 is better). SINR is signal quality — how clean the
          signal is from noise (higher is better). RSRQ combines both. The overall rating uses the
          worse of RSRP and SINR.
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  center: { textAlign: 'center' },
  metric: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 32 },
  metricName: { width: 44 },
  metricValue: { width: 92 },
  metricBar: { flex: 1 },
  metricRating: { width: 64, textAlign: 'right' },
});
