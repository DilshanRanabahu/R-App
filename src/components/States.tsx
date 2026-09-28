import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';

import { colors, radius, sizes, space } from '@/theme';
import { AppText } from './AppText';
import { Button } from './Button';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={sizes.iconLarge} color={colors.textMuted} />
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" color={colors.textSecondary} style={styles.center}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

/** Card-level "log in to see this" (DESIGN.md §10: don't block the whole app). */
export function LoginRequired({ message }: { message: string }) {
  return (
    <View style={styles.login}>
      <AppText variant="body" color={colors.textSecondary}>
        {message}
      </AppText>
      <Button label="Log in" variant="secondary" icon="log-in-outline" onPress={() => router.push('/login')} />
    </View>
  );
}

export function Skeleton({ width = '100%', height = 20 }: { width?: DimensionValue; height?: number }) {
  return <View style={[styles.skeleton, { width, height }]} />;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxxl, paddingHorizontal: space.xxl },
  center: { textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: space.sm },
  login: { gap: space.md },
  skeleton: { backgroundColor: colors.surfaceMuted, borderRadius: radius.control / 2 },
});
