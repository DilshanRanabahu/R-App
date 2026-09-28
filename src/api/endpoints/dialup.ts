import { routerClient } from '../client';

export async function getMobileData(): Promise<boolean> {
  const r = await routerClient.get<{ dataswitch?: string }>('/api/dialup/mobile-dataswitch');
  return r.dataswitch === '1';
}

/** Turning data off cuts internet for every device: confirm first (DESIGN.md §11). */
export async function setMobileData(enabled: boolean): Promise<void> {
  await routerClient.post('/api/dialup/mobile-dataswitch', { dataswitch: enabled ? 1 : 0 });
}
