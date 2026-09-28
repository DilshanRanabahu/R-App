import * as LocalAuthentication from 'expo-local-authentication';

export type DeviceAuthResult = 'ok' | 'cancelled' | 'no_lock';

/**
 * Re-authenticate the phone owner (biometric or device PIN) before a sensitive
 * action (AGENTS.md §8.8). Without any screen lock the action is blocked.
 */
export async function requireDeviceAuth(reason: string): Promise<DeviceAuthResult> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) return 'no_lock';

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return result.success ? 'ok' : 'cancelled';
}

export const NO_LOCK_MESSAGE =
  'Set a screen lock (PIN, pattern or fingerprint) on your phone to use this action.';
