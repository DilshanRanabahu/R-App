import { OUI_BY_BRAND } from './ouiData';

// Device maker from the first half of a MAC address, looked up in a table bundled with
// the app (no network lookup, AGENTS.md §8.6).

let table: Map<string, string> | null = null;

function prefixTable(): Map<string, string> {
  if (table) return table;
  table = new Map();
  for (const [brand, prefixes] of Object.entries(OUI_BY_BRAND)) {
    for (let i = 0; i + 6 <= prefixes.length; i += 6) table.set(prefixes.slice(i, i + 6), brand);
  }
  return table;
}

function hexDigits(mac: string): string {
  return mac.replace(/[^0-9a-f]/gi, '').toUpperCase();
}

/**
 * Phones often use a random "private" address per Wi-Fi network (the locally
 * administered bit is set). Such an address says nothing about the maker.
 */
export function isPrivateMac(mac: string): boolean {
  const second = hexDigits(mac)[1];
  return second !== undefined && '26AE'.includes(second);
}

/** Brand name for a MAC address, or null if it is private, invalid or not in the table. */
export function lookupVendor(mac: string): string | null {
  const hex = hexDigits(mac);
  if (hex.length !== 12 || isPrivateMac(mac)) return null;
  return prefixTable().get(hex.slice(0, 6)) ?? null;
}
