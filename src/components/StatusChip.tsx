import { StyleSheet, View } from 'react-native';

import { radius, space, toneColors, type Tone } from '@/theme';
import { AppText } from './AppText';

const DOT = 8;

export function StatusChip({ tone, label, dot = true }: { tone: Tone; label: string; dot?: boolean }) {
  const { fg, bg } = toneColors(tone);
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {dot && <View style={[styles.dot, { backgroundColor: fg }]} />}
      <AppText variant="label" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
});
