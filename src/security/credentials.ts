import * as SecureStore from 'expo-secure-store';

// The only module that stores the router password (AGENTS.md §8.2).
const PASSWORD_KEY = 'router_password_v1';
const USERNAME_KEY = 'router_username_v1';
const SAVED_FLAG_KEY = 'router_password_saved_v1';

const PROTECTED: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: true,
  authenticationPrompt: 'Unlock to use your saved router password',
};

const PLAIN: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export function canRememberPassword(): boolean {
  return SecureStore.canUseBiometricAuthentication();
}

/** Throws if the device has no biometrics/screen lock; the caller shows why. */
export async function rememberPassword(username: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(PASSWORD_KEY, password, PROTECTED);
  await SecureStore.setItemAsync(USERNAME_KEY, username, PLAIN);
  await SecureStore.setItemAsync(SAVED_FLAG_KEY, '1', PLAIN);
}

export async function hasRememberedPassword(): Promise<boolean> {
  return (await SecureStore.getItemAsync(SAVED_FLAG_KEY, PLAIN)) === '1';
}

export function getRememberedUsername(): Promise<string | null> {
  return SecureStore.getItemAsync(USERNAME_KEY, PLAIN);
}

/** Prompts for biometrics / device PIN. Returns null if cancelled or missing. */
export async function loadRememberedPassword(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PASSWORD_KEY, PROTECTED);
  } catch {
    return null;
  }
}

export async function forgetPassword(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(PASSWORD_KEY, PROTECTED),
    SecureStore.deleteItemAsync(USERNAME_KEY, PLAIN),
    SecureStore.deleteItemAsync(SAVED_FLAG_KEY, PLAIN),
  ]);
}
