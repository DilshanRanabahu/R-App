import { routerClient } from '../client';
import type { CurrentPlmnRaw, NetworkGeneration, Operator } from '../types';

// 3GPP radio access technology codes.
const RAT: Record<string, NetworkGeneration> = {
  '0': '2G',
  '2': '3G',
  '7': '4G',
};

export async function getOperator(): Promise<Operator> {
  const r = await routerClient.get<CurrentPlmnRaw>('/api/net/current-plmn');
  return {
    name: r.ShortName || r.FullName || 'Unknown',
    generation: RAT[r.Rat ?? ''] ?? 'Unknown',
  };
}
