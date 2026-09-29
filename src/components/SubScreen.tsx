import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, sizes, space } from '@/theme';
import { AppText } from './AppText';

/** Pushed screen shell: back arrow + title, keyboard-aware scroll (DESIGN.md §8). */
export function SubScreen({
  title,
  fallback,
  children,
}: {
  title: string;
  /** Where "back" goes if there is no history (e.g. opened directly). */
  fallback: Href;
  children: ReactNode;
}) {
  const back = () => (router.canGoBack() ? router.back() : router.replace(fallback));
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior="height" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable
              onPress={back}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={space.sm}
              style={styles.back}
            >
              <Ionicons name="arrow-back" size={sizes.icon} color={colors.textPrimary} />
            </Pressable>
            <AppText variant="title" accessibilityRole="header" style={styles.flex}>
              {title}
            </AppText>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function goBack(fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  back: { padding: space.sm, marginLeft: -space.sm },
});
