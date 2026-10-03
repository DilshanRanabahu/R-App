import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, hairline, sizes, space } from '@/theme';
import { AppText } from './AppText';

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  right?: ReactNode;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  divider?: boolean;
  accessibilityHint?: string;
  /** Show the chevron even when `right` is set (a tappable row with a chip). */
  chevron?: boolean;
  /** Greyed icon and title, e.g. a device that isn't connected. */
  muted?: boolean;
}

export function ListRow({
  title,
  subtitle,
  icon,
  right,
  value,
  onPress,
  destructive,
  divider,
  accessibilityHint,
  chevron,
  muted,
}: ListRowProps) {
  const titleColor = destructive ? colors.danger : muted ? colors.textSecondary : colors.textPrimary;
  const iconColor = destructive ? colors.danger : muted ? colors.textMuted : colors.textSecondary;
  const body = (
    <>
      {icon && (
        <Ionicons name={icon} size={sizes.icon} color={iconColor} />
      )}
      <View style={styles.text}>
        <AppText variant="body" color={titleColor} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="label" color={colors.textSecondary} numeric>
          {value}
        </AppText>
      ) : null}
      {right}
      {onPress && (!right || chevron) && !destructive && (
        <Ionicons name="chevron-forward" size={sizes.iconSmall} color={colors.textMuted} />
      )}
    </>
  );

  const rowStyle = [styles.row, divider && styles.divider];
  if (!onPress) return <View style={rowStyle}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.surfaceMuted }}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      style={rowStyle}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.listRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  divider: { borderTopWidth: hairline, borderTopColor: colors.border },
  text: { flex: 1, gap: 2 },
});
