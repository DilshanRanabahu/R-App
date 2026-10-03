import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { isRouterError, userMessage } from '@/api/errors';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, LoginRequired, Skeleton } from '@/components/States';
import { StatusChip } from '@/components/StatusChip';
import { SubScreen } from '@/components/SubScreen';
import { useLteBands, useSetLteBand, useSignal } from '@/hooks/router';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { NO_LOCK_MESSAGE, requireDeviceAuth } from '@/security/deviceAuth';
import { useAuth } from '@/state/AuthProvider';
import { useSnackbar } from '@/state/SnackbarProvider';
import { colors, hairline, sizes, space, toneColors } from '@/theme';
import { bandLabel, bandsFromMask, describeSelection, maskForBand } from '@/utils/bands';
import { RATING_LABEL, RATING_TONE, overallRating } from '@/utils/signal';

/** `null` = Automatic (all bands the router supports). */
type Choice = number | null;

function Option({
  title,
  subtitle,
  selected,
  busy,
  divider,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  busy: boolean;
  divider: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={selected || busy ? undefined : onPress}
      android_ripple={{ color: colors.surfaceMuted }}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: busy }}
      style={[styles.option, divider && styles.divider]}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={sizes.icon}
        color={selected ? colors.primary : colors.textMuted}
      />
      <View style={styles.optionText}>
        <AppText variant="body">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color={colors.textSecondary}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * LTE band lock (FEATURES 3.6). Automatic lets the router pick; one band can be steadier
 * when the automatic choice keeps hopping. A band the operator doesn't use here means no
 * internet until it is switched back, so every change is confirmed and re-authenticated.
 */
export default function LteBandScreen() {
  const focused = useScreenFocus();
  const { status } = useAuth();
  const snackbar = useSnackbar();
  const bands = useLteBands(focused);
  const signal = useSignal(focused);
  const setBand = useSetLteBand();
  const [pending, setPending] = useState<{ choice: Choice } | null>(null);

  if (status !== 'logged_in') {
    return (
      <SubScreen title="4G band" fallback="/router">
        <Card>
          <LoginRequired message="Log in to choose which 4G band your router uses." />
        </Card>
      </SubScreen>
    );
  }

  const data = bands.data;
  const selection = data ? describeSelection(data.current, data.supported) : null;
  const supported = data ? bandsFromMask(data.supported) : [];
  const s = signal.data;
  const rating = s ? overallRating(s.rsrp, s.sinr) : 'unknown';

  const apply = async () => {
    const choice = pending?.choice;
    setPending(null);
    if (choice === undefined || !data) return;
    const auth = await requireDeviceAuth('Confirm 4G band change');
    if (auth === 'no_lock') return snackbar.show(NO_LOCK_MESSAGE);
    if (auth !== 'ok') return;
    setBand.mutate(choice === null ? data.supported : maskForBand(choice), {
      onSuccess: () =>
        snackbar.show(
          choice === null
            ? 'Back to Automatic. The router is reconnecting.'
            : `Using Band ${choice} only. Watch the signal for a minute.`,
        ),
      onError: (e) =>
        snackbar.show(
          // Re-registering on the network can outlast the request.
          isRouterError(e, 'timeout')
            ? 'The router is still switching. Check again in a moment.'
            : userMessage(e),
        ),
    });
  };

  return (
    <SubScreen title="4G band" fallback="/router">
      <Card title="Right now" right={s ? <StatusChip tone={RATING_TONE[rating]} label={RATING_LABEL[rating]} /> : undefined}>
        {s ? (
          <>
            <AppText variant="heading" numeric>
              {s.band ? bandLabel(Number(s.band)) : 'Band unknown'}
            </AppText>
            <AppText variant="caption" color={toneColors(RATING_TONE[rating]).fg} numeric>
              {[s.rsrp !== null ? `Strength ${s.rsrp} dBm` : null, s.sinr !== null ? `Quality ${s.sinr} dB` : null]
                .filter(Boolean)
                .join(' · ') || 'No signal reading'}
            </AppText>
          </>
        ) : (
          <Skeleton height={sizes.touchTarget} />
        )}
        <AppText variant="caption" color={colors.textMuted}>
          Updates every few seconds, so you can see what a change does.
        </AppText>
      </Card>

      {!data ? (
        <Card>
          {bands.isError ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Couldn't read the band setting"
              message={userMessage(bands.error)}
              actionLabel="Retry"
              onAction={() => void bands.refetch()}
            />
          ) : (
            <>
              <Skeleton height={sizes.touchTarget} />
              <Skeleton height={sizes.touchTarget} />
              <Skeleton height={sizes.touchTarget} />
            </>
          )}
        </Card>
      ) : (
        <>
          <Card title="Use this band" style={styles.list}>
            <View accessibilityRole="radiogroup">
              <Option
                title="Automatic"
                subtitle={`Recommended. The router picks from bands ${supported.join(', ')}.`}
                selected={selection?.kind === 'auto'}
                busy={setBand.isPending}
                divider={false}
                onPress={() => setPending({ choice: null })}
              />
              {supported.map((band) => (
                <Option
                  key={band}
                  title={bandLabel(band)}
                  subtitle={s?.band === String(band) ? 'In use right now' : undefined}
                  selected={selection?.kind === 'single' && selection.band === band}
                  busy={setBand.isPending}
                  divider
                  onPress={() => setPending({ choice: band })}
                />
              ))}
            </View>
          </Card>
          {selection?.kind === 'custom' && (
            <AppText variant="caption" color={colors.textSecondary}>
              The router is set to bands {selection.bands.join(', ')} (changed somewhere else). Choose Automatic to go
              back to normal.
            </AppText>
          )}
          <AppText variant="caption" color={colors.textMuted}>
            {setBand.isPending
              ? 'Switching… this can take up to a minute.'
              : 'Locking one band can make a weak connection steadier, but only if your operator uses that band where you live. If the internet stops, come back here and choose Automatic: this app keeps working.'}
          </AppText>
        </>
      )}

      <ConfirmDialog
        visible={pending !== null}
        title={pending?.choice == null ? 'Go back to Automatic?' : `Use only Band ${pending.choice}?`}
        message={
          pending?.choice == null
            ? 'The router reconnects and picks the band itself. Internet drops for a few seconds.'
            : 'The router reconnects on this band only. If your operator doesn’t use it here, the internet stops until you choose Automatic again.'
        }
        confirmLabel={pending?.choice == null ? 'Automatic' : 'Use this band'}
        destructive={pending?.choice != null}
        onConfirm={() => void apply()}
        onCancel={() => setPending(null)}
      />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  option: {
    minHeight: sizes.listRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  divider: { borderTopWidth: hairline, borderTopColor: colors.border },
  optionText: { flex: 1, gap: 2 },
});
