import type { Host, HostConnection } from '@/api/types';
import { normalizeMac, validateMac } from '@/api/validate';
import { lookupVendor } from './vendor';

// What the owner told the app about a device (stored on the phone, keyed by MAC).

export const DEVICE_KINDS = [
  { id: 'phone', label: 'Phone', icon: 'phone-portrait-outline' },
  { id: 'tablet', label: 'Tablet', icon: 'tablet-portrait-outline' },
  { id: 'laptop', label: 'Laptop', icon: 'laptop-outline' },
  { id: 'desktop', label: 'Computer', icon: 'desktop-outline' },
  { id: 'tv', label: 'TV', icon: 'tv-outline' },
  { id: 'console', label: 'Game console', icon: 'game-controller-outline' },
  { id: 'speaker', label: 'Speaker', icon: 'volume-high-outline' },
  { id: 'printer', label: 'Printer', icon: 'print-outline' },
  { id: 'camera', label: 'Camera', icon: 'videocam-outline' },
  { id: 'other', label: 'Other', icon: 'hardware-chip-outline' },
] as const;

export type DeviceKind = (typeof DEVICE_KINDS)[number]['id'];
export type DeviceIconName = (typeof DEVICE_KINDS)[number]['icon'] | 'wifi-outline';

export interface DevicePrefs {
  nickname?: string;
  kind?: DeviceKind;
  /** The owner recognised this device. Anything else connected is shown as "New". */
  known?: boolean;
}

export type DevicePrefsMap = Record<string, DevicePrefs>;

export const UNKNOWN_NAME = 'Unknown device';

export const CONNECTION_LABEL: Record<HostConnection, string> = {
  wifi: 'Wi-Fi',
  cable: 'Cable',
  unknown: 'Connected',
};

export function isDeviceKind(value: unknown): value is DeviceKind {
  return DEVICE_KINDS.some((k) => k.id === value);
}

/**
 * Two independent signs, either is enough: the router marks the asking device, and the
 * phone knows its own IP. Blocking is refused for this phone, so err on the safe side.
 */
export function isThisPhone(host: Host, phoneIp: string | null): boolean {
  return host.active && (host.self === true || (!!phoneIp && host.ip === phoneIp));
}

/** Nickname, else the name the device reported, else "<Maker> device", else "Unknown device". */
export function deviceTitle(host: Host, prefs: DevicePrefs | undefined): string {
  if (prefs?.nickname) return prefs.nickname;
  if (host.name && host.name !== UNKNOWN_NAME) return host.name;
  const vendor = lookupVendor(host.mac);
  return vendor ? `${vendor} device` : UNKNOWN_NAME;
}

export function deviceIcon(host: Host, prefs: DevicePrefs | undefined, thisPhone: boolean): DeviceIconName {
  const kind = DEVICE_KINDS.find((k) => k.id === prefs?.kind);
  if (kind) return kind.icon;
  if (thisPhone) return 'phone-portrait-outline';
  return host.connection === 'cable' ? 'desktop-outline' : 'wifi-outline';
}

export function isKnown(host: Host, prefs: DevicePrefs | undefined, thisPhone: boolean): boolean {
  return thisPhone || prefs?.known === true;
}

/** A blocked device may be missing from the router's host list; show it from the block list. */
export function hostFromBlocked(mac: string, name: string): Host {
  return { mac, ip: '', name: name || UNKNOWN_NAME, connectedSeconds: 0, connection: 'wifi', active: false };
}

export interface DeviceGroups {
  /** Blocked from the Wi-Fi. Listed here only, not in the other groups. */
  blocked: Host[];
  /** Connected and not recognised yet. */
  fresh: Host[];
  /** Connected and known (this phone first, then longest connected). */
  online: Host[];
  /** Remembered by the router but not connected now. */
  offline: Host[];
}

export function groupDevices(
  allHosts: Host[],
  prefs: DevicePrefsMap,
  phoneIp: string | null,
  blockedDevices: { mac: string; name: string }[] = [],
): DeviceGroups {
  const byTime = (a: Host, b: Host) => b.connectedSeconds - a.connectedSeconds;
  const byName = (a: Host, b: Host) => deviceTitle(a, prefs[a.mac]).localeCompare(deviceTitle(b, prefs[b.mac]));
  const blockedMacs = new Set(blockedDevices.map((b) => b.mac));
  const hosts = allHosts.filter((h) => !blockedMacs.has(h.mac));
  const active = hosts.filter((h) => h.active);
  const known = (h: Host) => isKnown(h, prefs[h.mac], isThisPhone(h, phoneIp));
  return {
    blocked: blockedDevices
      .map((b) => allHosts.find((h) => h.mac === b.mac) ?? hostFromBlocked(b.mac, b.name))
      .sort(byName),
    fresh: active.filter((h) => !known(h)).sort(byTime),
    online: active.filter(known).sort((a, b) => {
      if (isThisPhone(a, phoneIp)) return -1;
      if (isThisPhone(b, phoneIp)) return 1;
      return byTime(a, b);
    }),
    offline: hosts.filter((h) => !h.active).sort(byName),
  };
}

// MAC addresses travel in the route as AA-BB-CC-DD-EE-FF (no colons in URLs).

export function macToParam(mac: string): string {
  return normalizeMac(mac).replace(/:/g, '-');
}

/** The MAC from a route parameter, or null if it isn't a valid MAC (deep links are untrusted). */
export function paramToMac(param: string | string[] | undefined): string | null {
  if (typeof param !== 'string') return null;
  const mac = normalizeMac(param);
  return validateMac(mac) === null ? mac : null;
}
