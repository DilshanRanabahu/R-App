import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors, hairline, radius, sizes, space } from '@/theme';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'danger' | 'dangerFilled';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  secondary: { bg: colors.primaryBg, fg: colors.primary },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
  dangerFilled: { bg: colors.danger, fg: colors.onPrimary },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  loadingLabel,
  disabled,
  icon,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      android_ripple={{ color: colors.overlay }}
      style={[
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border ?? v.bg, opacity: inactive ? 0.5 : 1 },
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={v.fg} />
        ) : (
          icon && <Ionicons name={icon} size={sizes.iconSmall} color={v.fg} />
        )}
        <AppText variant="heading" color={v.fg}>
          {loading && loadingLabel ? loadingLabel : label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: sizes.touchTarget,
    borderRadius: radius.control,
    borderWidth: hairline,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
