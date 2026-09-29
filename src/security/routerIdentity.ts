import * as SecureStore from 'expo-secure-store';

import { sha256Hex } from '@/api/crypto';
import { RouterError } from '@/api/errors';
import { getBasicInformation, getDeviceInformation, getPublicKey } from '@/api/endpoints/device';

// Router fingerprint pinning (AGENTS.md §8.5). Only hashes are stored.
//  - pre-login:  device name + RSA public key (both readable without login), checked
//                BEFORE the password hash is sent, so a look-alike router gets nothing.
//  - post-login: device name + serial + MAC, checked right after login.
const PRE_KEY = 'router_pin_pre_v1';
const POST_KEY = 'router_pin_post_v1';
const EXPECTED_MODEL = 'B312-926';

export type PinResult = 'match' | 'new' | 'mismatch';

const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function compare(key: string, fingerprint: string): Promise<PinResult> {
  const saved = await SecureStore.getItemAsync(key, OPTS);
  if (!saved) return 'new';
  return saved === fingerprint ? 'match' : 'mismatch';
}

function keyFingerprint(deviceName: string, n: string, e: string): Promise<string> {
  return sha256Hex(`${deviceName}|${n}|${e}`);
}

export async function preLoginFingerprint(): Promise<string> {
  const [{ deviceName }, key] = await Promise.all([getBasicInformation(), getPublicKey()]);
  return keyFingerprint(deviceName, key.encpubkeyn ?? '', key.encpubkeye ?? '');
}

/**
 * The router's RSA key, but only if it matches the router pinned at login. Every secret
 * we encrypt (admin / Wi-Fi password, reveal secrets) uses this, so a look-alike router
 * that hands out its own key gets nothing it can decrypt (AGENTS.md §8.5).
 */
export async function trustedPublicKey(): Promise<{ n: string; e: string }> {
  const [{ deviceName }, key] = await Promise.all([getBasicInformation(), getPublicKey()]);
  const n = key.encpubkeyn ?? '';
  const e = key.encpubkeye ?? '';
  if (!n || !e) throw new RouterError('invalid_response');
  const pinned = await SecureStore.getItemAsync(PRE_KEY, OPTS);
  if (!pinned || pinned !== (await keyFingerprint(deviceName, n, e))) {
    throw new RouterError('identity_mismatch');
  }
  return { n, e };
}

export async function postLoginFingerprint(): Promise<string> {
  const info = await getDeviceInformation();
  return sha256Hex(
    `${info.DeviceName ?? ''}|${info.SerialNumber ?? ''}|${(info.MacAddress1 ?? '').toUpperCase()}`,
  );
}

export function checkPreLogin(fingerprint: string): Promise<PinResult> {
  return compare(PRE_KEY, fingerprint);
}

export function checkPostLogin(fingerprint: string): Promise<PinResult> {
  return compare(POST_KEY, fingerprint);
}

export async function trustPreLogin(fingerprint: string): Promise<void> {
  await SecureStore.setItemAsync(PRE_KEY, fingerprint, OPTS);
}

export async function trustPostLogin(fingerprint: string): Promise<void> {
  await SecureStore.setItemAsync(POST_KEY, fingerprint, OPTS);
}

export async function forgetRouter(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(PRE_KEY, OPTS),
    SecureStore.deleteItemAsync(POST_KEY, OPTS),
  ]);
}

export function isExpectedModel(deviceName: string): boolean {
  return deviceName === EXPECTED_MODEL;
}
