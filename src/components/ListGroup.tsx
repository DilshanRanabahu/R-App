import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, space } from '@/theme';
import { AppText } from './AppText';
import { Card } from './Card';

/** Titled group of list rows (DESIGN.md §9.5). `danger` = red title for the danger zone. */
export function ListGroup({ title, danger, children }: { title: string; danger?: boolean; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText variant="label" color={danger ? colors.danger : colors.textSecondary}>
        {title}
      </AppText>
      <Card style={styles.card}>{children}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm, marginTop: space.sm },
  card: { paddingVertical: space.xs, gap: 0 },
});
