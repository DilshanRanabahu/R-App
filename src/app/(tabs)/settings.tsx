import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch } from 'react-native';

import { ListGroup } from '@/components/ListGroup';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { routerHost } from '@/hooks/router';
import { forgetPassword, hasRememberedPassword } from '@/security/credentials';
import { NO_LOCK_MESSAGE } from '@/security/deviceAuth';
import { useAppLock } from '@/state/AppLockProvider';
import { useAuth } from '@/state/AuthProvider';
import { useSnackbar } from '@/state/SnackbarProvider';
import { colors } from '@/theme';

/** Settings for the app itself. Anything that changes the router lives in the Router tab. */
export default function SettingsScreen() {
  const { status, logout } = useAuth();
  const loggedIn = status === 'logged_in';
  const snackbar = useSnackbar();
  const [saved, setSaved] = useState(false);
  const appLock = useAppLock();
  const [changingLock, setChangingLock] = useState(false);

  const toggleAppLock = (next: boolean) => {
    setChangingLock(true);
    void appLock
      .setEnabled(next)
      .then((result) => {
        if (result === 'no_lock') snackbar.show(NO_LOCK_MESSAGE);
        else if (result === 'ok') snackbar.show(next ? 'App lock is on.' : 'App lock is off.');
      })
      .finally(() => setChangingLock(false));
  };

  useEffect(() => {
    void hasRememberedPassword().then(setSaved);
  }, [status]);

  return (
    <Screen title="Settings">
      <ListGroup title="Account">
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
      </ListGroup>

      <ListGroup title="Security">
        <ListRow
          icon="lock-closed-outline"
          title="App lock"
          subtitle="Ask for fingerprint or PIN when the app opens"
          right={
            <Switch
              value={appLock.enabled}
              disabled={changingLock}
              onValueChange={toggleAppLock}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
              accessibilityLabel="App lock"
            />
          }
        />
      </ListGroup>

      <ListGroup title="App">
        <ListRow icon="globe-outline" title="Router address" value={routerHost()} />
        <ListRow
          icon="information-circle-outline"
          title="Version"
          value={Constants.expoConfig?.version ?? '–'}
          divider
        />
      </ListGroup>
    </Screen>
  );
}
