import { routerClient } from '../client';
import type {
  BasicInformationRaw,
  DeviceInformationRaw,
  PublicKeyRaw,
  RebootSchedule,
  RouterDetails,
  Signal,
  SignalRaw,
  TimeRebootRaw,
} from '../types';
import { decodeCharRefs, toNumber, toSignalValue } from './parse';

export async function getBasicInformation(): Promise<{ deviceName: string; marketingName: string }> {
  const r = await routerClient.get<BasicInformationRaw>('/api/device/basic_information');
  return { deviceName: r.devicename ?? '', marketingName: r.spreadname_en ?? '' };
}

/** Needs login. Used only for router fingerprinting; never persisted raw. */
export function getDeviceInformation(): Promise<DeviceInformationRaw> {
  return routerClient.get<DeviceInformationRaw>('/api/device/information');
}

/**
 * Needs login. Picks firmware + uptime only, so the IMEI/IMSI/serial/MACs in the
 * same response never reach the query cache or the UI (AGENTS.md §8.7).
 */
export async function getRouterDetails(): Promise<RouterDetails> {
  const r = await getDeviceInformation();
  return {
    firmware: r.SoftwareVersion ? decodeCharRefs(r.SoftwareVersion) : null,
    uptimeSeconds: r.uptime ? toNumber(r.uptime) : null,
  };
}

export function getPublicKey(): Promise<PublicKeyRaw> {
  return routerClient.get<PublicKeyRaw>('/api/webserver/publickey');
}

export async function getSignal(): Promise<Signal> {
  const r = await routerClient.get<SignalRaw>('/api/device/signal');
  return {
    rsrp: toSignalValue(r.rsrp),
    rsrq: toSignalValue(r.rsrq),
    sinr: toSignalValue(r.sinr),
    rssi: toSignalValue(r.rssi),
    pci: r.pci ?? '',
    cellId: r.cell_id ?? '',
    band: r.band ?? '',
  };
}

/** Needs login. The router's own "restart every N days in a quiet window" (diagnosis/time_reboot). */
export async function getRebootSchedule(): Promise<RebootSchedule> {
  const r = await routerClient.get<TimeRebootRaw>('/api/diagnosis/time_reboot');
  return {
    enabled: r.enable === '1',
    everyDays: toNumber(r.dayinterval),
    fromMinute: toNumber(r.begintime),
    toMinute: toNumber(r.endtime),
  };
}

/**
 * Needs login. Switch the scheduled restart on or off. Like the web page
 * (systemsettings.js changeTimeRebootSwitch): send the settings back with `enable` flipped.
 */
export async function setRebootScheduleEnabled(enabled: boolean): Promise<void> {
  const r = await routerClient.get<TimeRebootRaw>('/api/diagnosis/time_reboot');
  await routerClient.post(
    '/api/diagnosis/time_reboot',
    {
      enable: enabled ? 1 : 0,
      dayinterval: r.dayinterval ?? '',
      begintime: r.begintime ?? '',
      endtime: r.endtime ?? '',
    },
    { retryBadToken: false },
  );
}

/** Dangerous: callers must confirm + re-auth first (AGENTS.md §8.8). */
export async function rebootRouter(): Promise<void> {
  await routerClient.post('/api/device/control', { Control: 1 });
}
