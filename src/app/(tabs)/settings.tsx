import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { userMessage } from '@/api/errors';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { routerHost, useReboot } from '@/hooks/router';
import { forgetPassword, hasRememberedPassword } from '@/security/credentials';
import { NO_LOCK_MESSAGE, requireDeviceAuth } from '@/security/deviceAuth';
import { useAuth } from '@/state/AuthProvider';
import { useSnackbar } from '@/state/SnackbarProvider';
import { colors, space } from '@/theme';

function Group({ title, danger, children }: { title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText variant="label" color={danger ? colors.danger : colors.textSecondary}>
        {title}
      </AppText>
      <Card style={styles.groupCard}>{children}</Card>
    </View>
  );
}

export default function SettingsScreen() {
  const { status, logout } = useAuth();
  const loggedIn = status === 'logged_in';
  const snackbar = useSnackbar();
  const reboot = useReboot();
  const [confirmReboot, setConfirmReboot] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void hasRememberedPassword().then(setSaved);
  }, [status]);

  const doReboot = async () => {
    setConfirmReboot(false);
    const auth = await requireDeviceAuth('Confirm router reboot');
    if (auth === 'no_lock') return snackbar.show(NO_LOCK_MESSAGE);
    if (auth !== 'ok') return;
    reboot.mutate(undefined, {
      onSuccess: () => router.push('/rebooting'),
      onError: (e) => snackbar.show(userMessage(e)),
    });
  };

  return (
    <Screen title="Settings">
      <Group title="Account">
        {loggedIn ? (
          <ListRow icon="log-out-outline" title="Log out" onPress={() => void logout()} />
        ) : (
          <ListRow icon="log-in-outline" title="Log in" onPress={() => router.push('/login')} />
        )}
        {saved && (
          <ListRow
            icon="key-outline"
            title="Forget saved password"
            divider
            onPress={() =>
              void forgetPassword().then(() => {
                setSaved(false);
                snackbar.show('Saved password removed.');
              })
            }
          />
        )}
      </Group>

      <Group title="App">
        <ListRow icon="globe-outline" title="Router address" value={routerHost()} />
        <ListRow
          icon="information-circle-outline"
          title="Version"
          value={Constants.expoConfig?.version ?? '–'}
          divider
        />
      </Group>

      {loggedIn && (
        <Group title="Danger zone" danger>
          <ListRow
            icon="power"
            title={reboot.isPending ? 'Rebooting…' : 'Reboot router'}
            destructive
            onPress={reboot.isPending ? undefined : () => setConfirmReboot(true)}
          />
        </Group>
      )}

      <ConfirmDialog
        visible={confirmReboot}
        title="Reboot router?"
        message="Internet will be off for about 1–2 minutes."
        confirmLabel="Reboot"
        destructive
        onCancel={() => setConfirmReboot(false)}
        onConfirm={() => void doReboot()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm, marginTop: space.sm },
  groupCard: { paddingVertical: space.xs, gap: 0 },
});
