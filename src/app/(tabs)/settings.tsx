import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { ListGroup } from '@/components/ListGroup';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { routerHost } from '@/hooks/router';
import { forgetPassword, hasRememberedPassword } from '@/security/credentials';
import { useAuth } from '@/state/AuthProvider';
import { useSnackbar } from '@/state/SnackbarProvider';

/** Settings for the app itself. Anything that changes the router lives in the Router tab. */
export default function SettingsScreen() {
  const { status, logout } = useAuth();
  const loggedIn = status === 'logged_in';
  const snackbar = useSnackbar();
  const [saved, setSaved] = useState(false);

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
