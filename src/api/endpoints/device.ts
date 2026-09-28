import { routerClient } from '../client';
import type {
  BasicInformationRaw,
  DeviceInformationRaw,
  PublicKeyRaw,
  Signal,
  SignalRaw,
} from '../types';
import { toSignalValue } from './parse';

export async function getBasicInformation(): Promise<{ deviceName: string }> {
  const r = await routerClient.get<BasicInformationRaw>('/api/device/basic_information');
  return { deviceName: r.devicename ?? '' };
}

/** Needs login. Used only for router fingerprinting; never persisted raw. */
export function getDeviceInformation(): Promise<DeviceInformationRaw> {
  return routerClient.get<DeviceInformationRaw>('/api/device/information');
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

/** Dangerous: callers must confirm + re-auth first (AGENTS.md §8.8). */
export async function rebootRouter(): Promise<void> {
  await routerClient.post('/api/device/control', { Control: 1 });
}
