import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ListGroup } from '@/components/ListGroup';
import { ListRow } from '@/components/ListRow';
import { SignalBars } from '@/components/SignalBars';
import { LoginRequired, Skeleton } from '@/components/States';
import { StatusChip } from '@/components/StatusChip';
import { SubScreen } from '@/components/SubScreen';
import { useSignalFast } from '@/hooks/router';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { useAuth } from '@/state/AuthProvider';
import { colors, radius, sizes, space, toneColors } from '@/theme';
import { EMPTY_TRACK, addReading, belowBest, rsrpFraction, trend, type AntennaTrack } from '@/utils/antenna';
import { RATING_LABEL, RATING_TONE, overallRating, rateRsrp } from '@/utils/signal';

const TREND_TEXT = { better: 'Getting stronger', worse: 'Getting weaker', steady: 'Steady' } as const;
const TREND_ICON = { better: '▲', worse: '▼', steady: '●' } as const;

/**
 * Antenna positioning mode (FEATURES 3.4): one big live signal number, the best value so
 * far and a short history, refreshed every second while the owner moves the router.
 */
export default function AntennaScreen() {
  // The owner is carrying the router around, not touching the phone.
  useKeepAwake();

  const focused = useScreenFocus();
  const { status } = useAuth();
  const signal = useSignalFast(focused);
  const [track, setTrack] = useState<AntennaTrack>(EMPTY_TRACK);
  const [seenAt, setSeenAt] = useState(0);
  const [vibrate, setVibrate] = useState(true);

  // One reading per router answer.
  if (signal.data && signal.dataUpdatedAt !== seenAt) {
    setSeenAt(signal.dataUpdatedAt);
    setTrack((t) => addReading(t, signal.data.rsrp));
  }

  // A short buzz each time a new best is reached (not for the very first reading).
  const lastBest = useRef<number | null>(null);
  useEffect(() => {
    if (track.best !== null && lastBest.current !== null && track.best > lastBest.current && vibrate) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    lastBest.current = track.best;
  }, [track.best, vibrate]);

  if (status !== 'logged_in') {
    return (
      <SubScreen title="Find best position" fallback="/signal">
        <Card>
          <LoginRequired message="Log in to measure your signal while you move the router." />
        </Card>
      </SubScreen>
    );
  }

  const s = signal.data;
  const rating = s ? overallRating(s.rsrp, s.sinr) : 'unknown';
  const tone = toneColors(RATING_TONE[rating]);
  const below = belowBest(s?.rsrp ?? null, track.best);
  const direction = trend(track.history);

  return (
    <SubScreen title="Find best position" fallback="/signal">
      <View
        style={[styles.hero, { backgroundColor: tone.bg }]}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={
          s?.rsrp != null ? `Signal ${RATING_LABEL[rating]}, ${s.rsrp} dBm` : 'Measuring signal'
        }
      >
        {s ? (
          <>
            <SignalBars rating={rating} size={sizes.iconLarge} />
            <View style={styles.valueRow}>
              <AppText variant="hero" color={tone.fg} numeric>
                {s.rsrp ?? '–'}
              </AppText>
              <AppText variant="heading" color={tone.fg}>
                dBm
              </AppText>
            </View>
            <AppText variant="heading" color={tone.fg}>
              {RATING_LABEL[rating]}
            </AppText>
            <AppText variant="caption" color={colors.textSecondary} numeric>
              {[
                `${TREND_ICON[direction]} ${TREND_TEXT[direction]}`,
                s.sinr !== null ? `Quality (SINR) ${s.sinr} dB` : null,
                s.band ? `Band ${s.band}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </>
        ) : signal.isError ? (
          <AppText variant="body" color={colors.textSecondary} style={styles.center}>
            Can&apos;t read the signal right now. Stay on the router&apos;s Wi-Fi.
          </AppText>
        ) : (
          <>
            <Skeleton width={sizes.chart} height={sizes.iconLarge} />
            <Skeleton width={160} height={40} />
          </>
        )}
      </View>

      <Card
        title="Best so far"
        right={
          below === null ? undefined : below === 0 ? (
            <StatusChip tone="success" label="Best spot" />
          ) : (
            <StatusChip tone="neutral" label={`${below} dB weaker now`} dot={false} />
          )
        }
      >
        <View style={styles.valueRow}>
          <AppText variant="display" numeric>
            {track.best ?? '–'}
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            dBm
          </AppText>
        </View>
        <View style={styles.history} accessible accessibilityLabel="Recent signal readings">
          {track.history.map((value, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: `${Math.max(8, rsrpFraction(value) * 100)}%`,
                  backgroundColor: toneColors(RATING_TONE[rateRsrp(value)]).fg,
                  opacity: value === track.best ? 1 : 0.4,
                },
              ]}
            />
          ))}
        </View>
        <AppText variant="caption" color={colors.textMuted}>
          Last {track.history.length} readings, newest on the right. Taller is stronger; the best ones are shown solid.
        </AppText>
        <Button
          label="Start again"
          variant="secondary"
          icon="refresh-outline"
          disabled={track.history.length === 0}
          onPress={() => setTrack(EMPTY_TRACK)}
        />
      </Card>

      <ListGroup title="Feedback">
        <ListRow
          icon="phone-portrait-outline"
          title="Vibrate on a new best"
          subtitle="A short buzz when the signal beats the best so far"
          right={
            <Switch
              value={vibrate}
              onValueChange={setVibrate}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
              accessibilityLabel="Vibrate on a new best"
            />
          }
        />
      </ListGroup>

      <Card title="How to use this">
        <AppText variant="body" color={colors.textSecondary}>
          1. Move the router to a new spot: near a window, higher up, away from thick walls.
        </AppText>
        <AppText variant="body" color={colors.textSecondary}>
          2. Wait about 5 seconds for the number to settle.
        </AppText>
        <AppText variant="body" color={colors.textSecondary}>
          3. Keep the spot where the number is closest to −70. −90 is better than −100.
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          The screen stays on while this page is open.
        </AppText>
      </Card>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.card,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs + 2 },
  center: { textAlign: 'center' },
  history: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: sizes.chart - space.xxl,
  },
  bar: { flex: 1, borderRadius: 2, minWidth: 2 },
});
