import { routerClient } from '../client';
import { isRouterError } from '../errors';
import { normalizeMac } from '../validate';
import { toArray } from '../xml';
import type {
  Host,
  HostConnection,
  HostListRaw,
  HostRaw,
  LanHostInfoRaw,
  LanHostRaw,
} from '../types';
import { toNumber } from './parse';

function toHost(h: HostRaw, connection: HostConnection, name?: string): Host {
  return {
    mac: normalizeMac(h.MacAddress ?? ''),
    // Some firmware lists "ipv4;ipv6" here.
    ip: (h.IpAddress ?? '').split(';')[0] ?? '',
    name: name || h.HostName || 'Unknown device',
    connectedSeconds: toNumber(h.AssociatedTime),
    connection,
  };
}

function lanConnection(h: LanHostRaw): HostConnection {
  const type = (h.InterfaceType ?? '').toLowerCase();
  if (type.includes('ethernet') || type.includes('lan')) return 'cable';
  if (type.includes('wireless') || type.includes('wlan') || type.includes('wifi')) return 'wifi';
  return 'unknown';
}

async function getWifiHosts(): Promise<Host[]> {
  const r = await routerClient.get<HostListRaw>('/api/wlan/host-list');
  return (r.Hosts ? toArray<HostRaw>(r.Hosts.Host) : []).map((h) => toHost(h, 'wifi'));
}

/** Null when this firmware doesn't offer the LAN list. */
async function getLanHosts(): Promise<Host[] | null> {
  try {
    const r = await routerClient.get<LanHostInfoRaw>('/api/lan/HostInfo');
    return (r.Hosts ? toArray<LanHostRaw>(r.Hosts.Host) : [])
      .filter((h) => h.Active === undefined || h.Active === '1')
      .map((h) => toHost(h, lanConnection(h), h.ActualName));
  } catch (e) {
    if (isRouterError(e, 'not_supported') || isRouterError(e, 'invalid_response')) return null;
    throw e;
  }
}

/**
 * Wi-Fi clients (wlan/host-list) merged with all clients (lan/HostInfo), so
 * devices on a network cable show up too. Merged by MAC.
 */
export async function getHosts(): Promise<Host[]> {
  const [wifi, lan] = await Promise.all([getWifiHosts(), getLanHosts()]);
  const byMac = new Map<string, Host>();
  for (const h of lan ?? []) byMac.set(h.mac || h.ip, h);
  for (const h of wifi) {
    const key = h.mac || h.ip;
    const existing = byMac.get(key);
    // The Wi-Fi list is authoritative for "wifi"; keep the LAN list's name if better.
    byMac.set(key, existing ? { ...existing, ...h, name: existing.name !== 'Unknown device' ? existing.name : h.name } : h);
  }
  // A LAN-list device that isn't in the Wi-Fi list is on a cable.
  const wifiMacs = new Set(wifi.map((h) => h.mac || h.ip));
  return [...byMac.entries()].map(([key, h]) =>
    h.connection === 'unknown' && !wifiMacs.has(key) ? { ...h, connection: 'cable' } : h,
  );
}
