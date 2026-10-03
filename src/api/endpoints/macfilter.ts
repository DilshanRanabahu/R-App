import { routerClient } from '../client';
import type { BlockList, BlockedDevice, MacFilterExRaw, MacFilterListRaw } from '../types';
import { normalizeMac, validateMac } from '../validate';
import { toArray } from '../xml';
import { decodeCharRefs, toNumber } from './parse';

// Wi-Fi MAC filter, done the way the router's own device page does it
// (devicemanagement.js changeAccess, emui webui 6):
//   read  GET  wlan/multi-macfilter-settings-ex  → enable, wifimacfilterstatus, block/allow lists
//   write POST wlan/multi-macfilter-settings     → the first SSID's block list + WifiMacFilterStatus
// Status: 0 = off, 1 = allow list, 2 = block list. Only Wi-Fi devices can be blocked.

const DEFAULT_SLOTS = 10; // the page's fallback when wifimaxmacfilternum is missing
const DENY = '2';
const OFF = '0';

export type BlockResult = 'ok' | 'full' | 'allow_list';

function firstList(raw: MacFilterExRaw): MacFilterListRaw {
  const first = toArray(raw.Ssids === '' ? undefined : raw.Ssids?.Ssid)[0];
  const list = first?.wifimacblacklist;
  return typeof list === 'object' && list !== null ? list : {};
}

function slotCount(list: MacFilterListRaw, max: number): number {
  const used = Object.keys(list)
    .map((k) => /^WifiMacFilterMac(\d+)$/.exec(k)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  return Math.max(max, ...used.map((n) => n + 1));
}

export function parseBlockList(raw: MacFilterExRaw, max: number): BlockList {
  const enabled = raw.enable === '1';
  const list = firstList(raw);
  const blocked: BlockedDevice[] = [];
  for (let i = 0; i < slotCount(list, max); i++) {
    const mac = normalizeMac(list[`WifiMacFilterMac${i}`] ?? '');
    if (validateMac(mac) === null) blocked.push({ mac, name: decodeCharRefs(list[`wifihostname${i}`] ?? '') });
  }
  return {
    mode: enabled && raw.wifimacfilterstatus === '1' ? 'allow' : enabled ? 'block' : 'off',
    blocked,
    max,
  };
}

/**
 * The Ssid entry to post, or why it can't be done. Mirrors the web page: keep the
 * current list, fill the first empty slot (block) or clear the device's slot (unblock).
 * Blocking always turns the block list on; unblocking leaves the filter as it was.
 */
export function buildBlockRequest(
  raw: MacFilterExRaw,
  max: number,
  mac: string,
  name: string,
  block: boolean,
): { result: BlockResult; entry?: Record<string, string | number> } {
  const enabled = raw.enable === '1';
  if (enabled && raw.wifimacfilterstatus === '1') return { result: 'allow_list' };

  const target = normalizeMac(mac);
  const list = { ...firstList(raw) };
  const slots = slotCount(list, max);
  const slotOf = (wanted: string) => {
    for (let i = 0; i < slots; i++) {
      if (normalizeMac(list[`WifiMacFilterMac${i}`] ?? '') === wanted) return i;
    }
    return -1;
  };

  const at = slotOf(target);
  if (block && at === -1) {
    let empty = -1;
    for (let i = 0; i < max && empty === -1; i++) if (!list[`WifiMacFilterMac${i}`]) empty = i;
    if (empty === -1) return { result: 'full' };
    list[`WifiMacFilterMac${empty}`] = target;
    list[`wifihostname${empty}`] = name;
  } else if (!block && at !== -1) {
    list[`WifiMacFilterMac${at}`] = '';
    list[`wifihostname${at}`] = '';
  }

  return {
    result: 'ok',
    entry: { ...list, WifiMacFilterStatus: block || enabled ? DENY : OFF, Index: 0 },
  };
}

async function readFilter(): Promise<{ raw: MacFilterExRaw; max: number }> {
  const [raw, feature] = await Promise.all([
    routerClient.get<MacFilterExRaw>('/api/wlan/multi-macfilter-settings-ex'),
    routerClient.get<{ wifimaxmacfilternum?: string }>('/api/wlan/wifi-feature-switch').catch(() => null),
  ]);
  return { raw, max: toNumber(feature?.wifimaxmacfilternum, DEFAULT_SLOTS) || DEFAULT_SLOTS };
}

/** Needs login. Devices blocked from the Wi-Fi, and whether the block list is active. */
export async function getBlockList(): Promise<BlockList> {
  const { raw, max } = await readFilter();
  return parseBlockList(raw, max);
}

/**
 * Needs login. Block or unblock one Wi-Fi device. Re-reads the list first so a change
 * made elsewhere (web UI) isn't overwritten. Never retried automatically.
 * Dangerous: confirm + device re-auth first (DESIGN.md §11, AGENTS.md §8.8).
 */
export async function setBlocked(change: { mac: string; name: string; block: boolean }): Promise<BlockResult> {
  if (validateMac(change.mac) !== null) throw new Error('Invalid MAC address');
  const { raw, max } = await readFilter();
  const { result, entry } = buildBlockRequest(raw, max, change.mac, change.name, change.block);
  if (result !== 'ok' || !entry) return result;
  await routerClient.post(
    '/api/wlan/multi-macfilter-settings',
    { Ssids: { Ssid: [entry] } },
    { retryBadToken: false },
  );
  return 'ok';
}
