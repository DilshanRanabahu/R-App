import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, hairline, radius, space } from '@/theme';
import { AppText } from './AppText';

interface CardProps {
  title?: string;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function Card({ title, right, onPress, accessibilityLabel, style, children }: CardProps) {
  // Always a Pressable, even when not tappable: swapping View <-> Pressable when
  // onPress toggles (e.g. on login) remounts the subtree and crashed Fabric.
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessible={!!onPress}
      android_ripple={onPress ? { color: colors.surfaceMuted } : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? accessibilityLabel : undefined}
      style={[styles.card, style]}
    >
      {(title || right) && (
        <View style={styles.header}>
          {title ? <AppText variant="heading">{title}</AppText> : <View />}
          {right}
        </View>
      )}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: hairline,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
});
