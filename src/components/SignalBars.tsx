import { StyleSheet, View } from 'react-native';

import { colors, toneColors } from '@/theme';
import { RATING_BARS, RATING_LABEL, RATING_TONE, type SignalRating } from '@/utils/signal';

export function SignalBars({ rating, size = 20 }: { rating: SignalRating; size?: number }) {
  const filled = RATING_BARS[rating];
  const { fg } = toneColors(RATING_TONE[rating]);
  const barWidth = Math.max(3, Math.round(size / 5));
  return (
    <View
      style={[styles.row, { height: size, gap: barWidth / 2 }]}
      accessible
      accessibilityLabel={`Signal ${RATING_LABEL[rating]}`}
    >
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={{
            width: barWidth,
            // 40% / 60% / 80% / 100% so the first bar still reads as a bar.
            height: (size * (i + 1)) / 5,
            borderRadius: barWidth / 2,
            backgroundColor: i <= filled ? fg : colors.border,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
