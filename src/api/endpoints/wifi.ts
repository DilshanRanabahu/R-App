import { getLoginState } from '../auth';
import { routerClient } from '../client';
import { decryptSecretReply, newSecretExchange, rsaEncryptHex } from '../crypto';
import { RouterError } from '../errors';
import type {
  GuestNetwork,
  GuestOffTime,
  GuestTimeRaw,
  SecretReplyRaw,
  WifiBasicRaw,
  WifiNetwork,
  WifiSsidRaw,
} from '../types';
import { escapeLikeWifiUi, parseResponse, toArray } from '../xml';
import { trustedPublicKey } from '@/security/routerIdentity';

import { decodeCharRefs, toNumber } from './parse';

/** The main 2.4 GHz network is Radio 1 / SSID 1; SSID 2 is the guest network. */
export function isMainSsid(s: WifiSsidRaw): boolean {
  return (s.ID ?? '').includes('Radio.1.Ssid.1.') || (s.ID === undefined && s.Index === '0');
}

/** RSA key + padding for secrets; the key must match the router pinned at login. */
async function routerKey() {
  const [state, key] = await Promise.all([getLoginState(), trustedPublicKey()]);
  return { key, padding: state.rsaPadding };
}

export interface WifiChange {
  ssid: string; // trimmed
  hidden: boolean;
  /** New password, or null to keep the current one. */
  newPassword: string | null;
}

// Fields the web UI nulls (= leaves out) before saving, unless it sets them itself.
const DROPPED_FIELDS = [
  'WifiWpapsk', 'MixWifiWpapsk', 'WifiWepKey1', 'WifiWepKey2', 'WifiWepKey3', 'WifiWepKey4',
  'WifiRadiusAddress', 'WifiRadiusPort', 'WifiRadiusKey', 'WifiBasicencryptionmodes',
  'WifiWpaencryptionmodes',
];

/**
 * Build the Ssid entry exactly like the router's Wi-Fi page (wifisecurity.js postAllData
 * + wificommon.js getBasicDataFromPage): start from the current entry, set name, hidden
 * flag and the auth-dependent encryption mode, and put the new password in only if it
 * changed, RSA-encrypted. Everything else is sent back unchanged.
 */
export function buildWifiSsid(
  current: WifiSsidRaw,
  change: WifiChange,
  encryptedPassword: string | null,
): Record<string, string> {
  const auth = current.WifiAuthmode ?? '';
  const set: Record<string, string | null> = {
    WifiSsid: change.ssid,
    WifiBroadcast: change.hidden ? '1' : '0',
    WifiBasicencryptionmodes: auth === 'AUTO' ? 'WEP' : auth === 'OPEN' ? 'NONE' : null,
    WifiWpaencryptionmodes: auth === 'WPA2-PSK' ? 'AES' : auth === 'WPA/WPA2-PSK' ? 'MIX' : null,
    WifiWpapsk: encryptedPassword,
    MixWifiWpapsk: encryptedPassword,
  };
  // Keep the router's field order (the page edits a copy of what it received).
  const entry: Record<string, string> = {};
  for (const [key, value] of Object.entries(current)) {
    if (key in set) {
      const next = set[key];
      if (next !== null && next !== undefined) entry[key] = next;
    } else if (value !== undefined && !DROPPED_FIELDS.includes(key)) {
      entry[key] = decodeCharRefs(value);
    }
  }
  for (const [key, value] of Object.entries(set)) {
    if (!(key in entry) && !(key in current) && value !== null) entry[key] = value;
  }
  return entry;
}

/**
 * Needs login. Save the main network's name / hidden flag / password like the router's
 * Wi-Fi page: POST wlan/multi-basic-settings with only that entry, WifiRestart=1, values
 * escaped with the page's wifiEncode, the password RSA-encrypted on its own and the
 * ";enp" content type. Wi-Fi restarts, so the phone usually disconnects right after.
 * Never retried automatically.
 */
export async function saveWifiNetwork(change: WifiChange): Promise<void> {
  const r = await routerClient.get<WifiBasicRaw>('/api/wlan/multi-basic-settings');
  const current = toArray(r.Ssids === '' ? undefined : r.Ssids?.Ssid).find(isMainSsid);
  if (!current) throw new RouterError('invalid_response');
  if (change.newPassword !== null && !['WPA2-PSK', 'WPA/WPA2-PSK'].includes(current.WifiAuthmode ?? '')) {
    // Other modes (WEP, WPA3, enterprise) use different fields; not supported here.
    throw new RouterError('not_supported');
  }

  let encrypted: string | null = null;
  if (change.newPassword !== null) {
    const { key, padding } = await routerKey();
    encrypted = rsaEncryptHex(escapeLikeWifiUi(change.newPassword), key, padding);
  }
  await routerClient.post(
    '/api/wlan/multi-basic-settings',
    { Ssids: { Ssid: [buildWifiSsid(current, change, encrypted)] }, WifiRestart: 1 },
    { escape: escapeLikeWifiUi, typeSuffix: 'enp', retryBadToken: false },
  );
}

/** Needs login. Name and visibility of the main network; the password is never included. */
export async function getWifiNetwork(): Promise<WifiNetwork> {
  const r = await routerClient.get<WifiBasicRaw>('/api/wlan/multi-basic-settings');
  const main = toArray(r.Ssids === '' ? undefined : r.Ssids?.Ssid).find(isMainSsid);
  if (!main) throw new RouterError('invalid_response');
  return {
    ssid: decodeCharRefs(main.WifiSsid ?? ''),
    enabled: main.WifiEnable === '1',
    hidden: main.WifiBroadcast === '1',
    security: main.WifiAuthmode ?? '',
  };
}

/**
 * Needs login. Reads the main network's password the way the router's web UI does
 * (user/pwd, module "wlan"): send two fresh secrets RSA-encrypted, get the settings
 * back AES-encrypted with a key derived from them, check the HMAC, decrypt.
 * The result is for display only; never store or log it (AGENTS.md §8.7).
 */
export async function revealWifiPassword(guest = false): Promise<string> {
  const { key, padding } = await routerKey();
  const exchange = newSecretExchange();
  const reply = await routerClient.post<SecretReplyRaw>('/api/user/pwd', {
    module: 'wlan',
    nonce: rsaEncryptHex(exchange.nonceHex + exchange.saltHex, key, padding),
  });
  if (!reply?.pwd || !reply.hash || !reply.iter) throw new RouterError('invalid_response');

  let xml: string;
  try {
    xml = decryptSecretReply(exchange, { pwd: reply.pwd, hash: reply.hash, iter: toNumber(reply.iter) });
  } catch {
    throw new RouterError('invalid_response');
  }
  const settings = parseResponse<WifiBasicRaw>(xml);
  const wanted = toArray(settings.Ssids === '' ? undefined : settings.Ssids?.Ssid).find(guest ? isGuestSsid : isMainSsid);
  if (!wanted?.WifiWpapsk) throw new RouterError('invalid_response');
  return decodeCharRefs(wanted.WifiWpapsk);
}

// ---- Guest Wi-Fi (copied from the router's guestwifi.js, emui webui 6) ----

export function isGuestSsid(s: WifiSsidRaw): boolean {
  return s.wifiisguestnetwork === '1';
}

const GUEST_OFF_TIMES: GuestOffTime[] = ['0', '4', '24'];
const GUEST_PASSWORD_AUTH = 'WPA/WPA2-PSK';

// What the page clears before posting the on/off switch (clearSecureData).
const SWITCH_CLEARED = [
  'WifiSsid', 'WifiRadiusKey', 'WifiWpapsk', 'MixWifiWpapsk',
  'WifiWepKey1', 'WifiWepKey2', 'WifiWepKey3', 'WifiWepKey4',
  'WifiWep128Key1', 'WifiWep128Key2', 'WifiWep128Key3', 'WifiWep128Key4',
];

function ssidEntries(r: WifiBasicRaw): WifiSsidRaw[] {
  return toArray(r.Ssids === '' ? undefined : r.Ssids?.Ssid);
}

/** Needs login. The guest network, or null if this router has none. */
export async function getGuestNetwork(): Promise<GuestNetwork | null> {
  const [basic, time] = await Promise.all([
    routerClient.get<WifiBasicRaw>('/api/wlan/multi-basic-settings'),
    routerClient.get<GuestTimeRaw>('/api/wlan/guesttime-setting').catch(() => null),
  ]);
  const guest = ssidEntries(basic).find(isGuestSsid);
  if (!guest) return null;
  const offTime = GUEST_OFF_TIMES.find((t) => t === guest.wifiguestofftime) ?? '0';
  return {
    ssid: decodeCharRefs(guest.WifiSsid ?? ''),
    enabled: guest.WifiEnable === '1',
    open: (guest.WifiAuthmode ?? 'OPEN') === 'OPEN',
    offTime,
    remainSeconds: toNumber(time?.remaintime),
    extendMinutes: toNumber(time?.extendtime, 30) || 30,
  };
}

/** Entries for the on/off switch: every SSID, secrets and names left out, guest WifiEnable set. */
export function buildGuestSwitch(entries: WifiSsidRaw[], enabled: boolean): Record<string, string>[] {
  return entries.map((entry) => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(entry)) {
      if (value !== undefined && !SWITCH_CLEARED.includes(key)) out[key] = decodeCharRefs(value);
    }
    if (isGuestSsid(entry)) out.WifiEnable = enabled ? '1' : '0';
    return out;
  });
}

/**
 * Needs login. Turn the guest network on or off like the page's switch (switchHandle →
 * postStatusSwitchSettings): all SSID entries without secrets, WifiRestart=1.
 * Wi-Fi restarts, so phones drop for a few seconds. Never retried.
 */
export async function setGuestEnabled(enabled: boolean): Promise<void> {
  const basic = await routerClient.get<WifiBasicRaw>('/api/wlan/multi-basic-settings');
  const entries = ssidEntries(basic);
  if (!entries.some(isGuestSsid)) throw new RouterError('not_supported');
  await routerClient.post(
    '/api/wlan/multi-basic-settings',
    { Ssids: { Ssid: buildGuestSwitch(entries, enabled) }, WifiRestart: 1 },
    { retryBadToken: false },
  );
}

export interface GuestChange {
  ssid: string; // trimmed
  open: boolean;
  /** New password; null keeps the current one (only possible when it already has one). */
  newPassword: string | null;
  offTime: GuestOffTime;
}

/** The guest entry to save (guestwifi.js guestSsidPostData). */
export function buildGuestSsid(
  current: WifiSsidRaw,
  change: GuestChange,
  encryptedPassword: string | null,
): Record<string, string> {
  const set: Record<string, string | null> = {
    WifiSsid: change.ssid,
    wifiguestofftime: change.offTime,
    WifiAuthmode: change.open ? 'OPEN' : GUEST_PASSWORD_AUTH,
    WifiBasicencryptionmodes: change.open ? 'NONE' : null,
    WifiWpaencryptionmodes: change.open ? null : 'MIX',
    WifiWpapsk: change.open ? null : encryptedPassword,
    MixWifiWpapsk: change.open ? null : encryptedPassword,
  };
  const entry: Record<string, string> = {};
  for (const [key, value] of Object.entries(current)) {
    if (key in set) {
      const next = set[key];
      if (next !== null && next !== undefined) entry[key] = next;
    } else if (value !== undefined && !DROPPED_FIELDS.includes(key)) {
      entry[key] = decodeCharRefs(value);
    }
  }
  for (const [key, value] of Object.entries(set)) {
    if (!(key in entry) && !(key in current) && value !== null) entry[key] = value;
  }
  return entry;
}

/**
 * Needs login. Save the guest network's name, security and auto-off time: only that
 * entry, ";enp", WifiRestart=1, password RSA-encrypted on its own. Never retried.
 */
export async function saveGuestNetwork(change: GuestChange): Promise<void> {
  const basic = await routerClient.get<WifiBasicRaw>('/api/wlan/multi-basic-settings');
  const current = ssidEntries(basic).find(isGuestSsid);
  if (!current) throw new RouterError('not_supported');
  const hadPassword = (current.WifiAuthmode ?? 'OPEN') !== 'OPEN';
  // Going from open to a password needs the password itself.
  if (!change.open && change.newPassword === null && !hadPassword) throw new RouterError('invalid_response');

  let encrypted: string | null = null;
  if (!change.open && change.newPassword !== null) {
    const { key, padding } = await routerKey();
    encrypted = rsaEncryptHex(escapeLikeWifiUi(change.newPassword), key, padding);
  }
  await routerClient.post(
    '/api/wlan/multi-basic-settings',
    { Ssids: { Ssid: [buildGuestSsid(current, change, encrypted)] }, WifiRestart: 1 },
    { escape: escapeLikeWifiUi, typeSuffix: 'enp', retryBadToken: false },
  );
}

/** Needs login. Keep the guest network on for `minutes` longer (the page's "extend" button). */
export async function extendGuestTime(minutes: number): Promise<void> {
  await routerClient.post('/api/wlan/guesttime-setting', { extendtime: minutes }, { retryBadToken: false });
}
