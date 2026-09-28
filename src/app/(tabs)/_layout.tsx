import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/States';
import { useRouterInfo } from '@/hooks/router';
import { colors, hairline, sizes, typography } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'signal', title: 'Signal', icon: 'cellular-outline', iconActive: 'cellular' },
  { name: 'devices', title: 'Devices', icon: 'phone-portrait-outline', iconActive: 'phone-portrait' },
  { name: 'messages', title: 'Messages', icon: 'chatbubble-outline', iconActive: 'chatbubble' },
  { name: 'settings', title: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
];

/** Full-screen "not on router Wi-Fi" state (DESIGN.md §10). */
function Unreachable({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <SafeAreaView style={styles.unreachable}>
      <EmptyState
        icon="cloud-offline-outline"
        title="Can't reach your router"
        message="Connect your phone to your router's Wi-Fi and try again."
        actionLabel={retrying ? 'Checking…' : 'Retry'}
        onAction={onRetry}
      />
    </SafeAreaView>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const info = useRouterInfo();

  if (info.isError && !info.data) {
    return <Unreachable onRetry={() => void info.refetch()} retrying={info.isFetching} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: typography.label,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: hairline,
          height: sizes.tabBar + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? t.iconActive : t.icon} size={sizes.icon} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  unreachable: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
});
