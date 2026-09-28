import { StyleSheet, View } from 'react-native';

import { colors, radius, sizes } from '@/theme';

/** value is 0..1 */
export function ProgressBar({ value, color = colors.primary }: { value: number; color?: string }) {
  const pct = Math.min(1, Math.max(0, value)) * 100;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: sizes.progressBar,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
