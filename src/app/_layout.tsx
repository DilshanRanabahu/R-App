import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useSessionWatcher } from '@/hooks/router';
import { AuthProvider } from '@/state/AuthProvider';
import { SnackbarProvider } from '@/state/SnackbarProvider';
import { queryClient } from '@/state/queryClient';
import { colors } from '@/theme';

function AppStack() {
  useSessionWatcher();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="rebooting" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      <Stack.Screen name="change-password" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="wifi" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            <AppStack />
          </AuthProvider>
        </SnackbarProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
