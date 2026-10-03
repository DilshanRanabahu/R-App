import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, hairline, radius, sizes, space } from '@/theme';
import { AppText } from './AppText';

interface Choice<T extends string> {
  id: T;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}

/** Pick one of a few options: wrapping row of pill chips, icon + label. */
export function ChoiceChips<T extends string>({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: readonly Choice<T>[];
  value: T | undefined;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.wrap}>
      <AppText variant="label" color={colors.textSecondary}>
        {label}
      </AppText>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {choices.map((c) => {
          const selected = c.id === value;
          const tint = selected ? colors.primary : colors.textSecondary;
          return (
            <Pressable
              key={c.id}
              onPress={() => onChange(c.id)}
              // 40 dp chip + slop = 48 dp touch target (DESIGN.md §13).
              hitSlop={(sizes.touchTarget - sizes.chip) / 2}
              android_ripple={{ color: colors.surfaceMuted }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={c.label}
              style={[styles.chip, selected && styles.selected]}
            >
              <Ionicons name={c.icon} size={sizes.iconSmall} color={tint} />
              <AppText variant="label" color={tint}>
                {c.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    height: sizes.chip,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
});
