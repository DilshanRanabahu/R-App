import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { NICKNAME_MAX_LENGTH, normalizeMac, validateMac } from '@/api/validate';
import { isDeviceKind, type DevicePrefs, type DevicePrefsMap } from '@/utils/devices';

// Nicknames, icons and the "known" mark per device, keyed by MAC (AGENTS.md §8.7: the
// only device data the app may keep on the phone). Never the router's device list itself.
const KEY = 'device_prefs_v1';
const MAX_DEVICES = 200;

interface Snapshot {
  prefs: DevicePrefsMap;
  loaded: boolean;
}

let snapshot: Snapshot = { prefs: {}, loaded: false };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(prefs: DevicePrefsMap): void {
  snapshot = { prefs, loaded: true };
  listeners.forEach((l) => l());
}

/** Stored data is re-checked on load: only valid MACs and known fields survive. */
export function sanitizePrefs(raw: unknown): DevicePrefsMap {
  const out: DevicePrefsMap = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>).slice(0, MAX_DEVICES)) {
    const mac = normalizeMac(key);
    if (validateMac(mac) !== null || typeof value !== 'object' || value === null) continue;
    const v = value as Record<string, unknown>;
    const entry: DevicePrefs = {};
    if (typeof v.nickname === 'string' && v.nickname.trim()) {
      entry.nickname = v.nickname.trim().slice(0, NICKNAME_MAX_LENGTH);
    }
    if (isDeviceKind(v.kind)) entry.kind = v.kind;
    if (v.known === true) entry.known = true;
    if (Object.keys(entry).length > 0) out[mac] = entry;
  }
  return out;
}

export function loadDevicePrefs(): Promise<void> {
  loading ??= AsyncStorage.getItem(KEY)
    .then((text) => publish(sanitizePrefs(text ? JSON.parse(text) : null)))
    .catch(() => publish({}));
  return loading;
}

async function save(next: DevicePrefsMap): Promise<void> {
  const clean = sanitizePrefs(next);
  publish(clean);
  await AsyncStorage.setItem(KEY, JSON.stringify(clean));
}

/** Merge changes into one device; `undefined` clears a field. */
export async function updateDevice(mac: string, patch: Partial<DevicePrefs>): Promise<void> {
  await loadDevicePrefs();
  const key = normalizeMac(mac);
  await save({ ...snapshot.prefs, [key]: { ...snapshot.prefs[key], ...patch } });
}

export async function markKnown(macs: string[]): Promise<void> {
  await loadDevicePrefs();
  const next = { ...snapshot.prefs };
  for (const mac of macs) {
    const key = normalizeMac(mac);
    next[key] = { ...next[key], known: true };
  }
  await save(next);
}

/** Drop everything the app remembers about a device (it shows as "New" again). */
export async function forgetDevice(mac: string): Promise<void> {
  await loadDevicePrefs();
  const next = { ...snapshot.prefs };
  delete next[normalizeMac(mac)];
  await save(next);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDevicePrefs(): Snapshot {
  useEffect(() => {
    void loadDevicePrefs();
  }, []);
  return useSyncExternalStore(subscribe, () => snapshot);
}

/** Tests only. */
export function resetDevicePrefsForTests(): void {
  snapshot = { prefs: {}, loaded: false };
  loading = null;
}
