import { ALL_LTE_BANDS, bandsFromMask, sameMask } from '@/utils/bands';

import { routerClient } from '../client';
import { RouterError } from '../errors';
import type { CurrentPlmnRaw, LteBands, NetModeListRaw, NetModeRaw, NetworkGeneration, Operator } from '../types';
import { toArray } from '../xml';

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

const HEX_MASK = /^[0-9A-F]{1,16}$/;

/**
 * Needs login. The LTE bands in use and the ones this router supports. In net-mode-list the
 * router lists its own band set (unnamed) next to "All bands"; that set is "Automatic".
 */
export async function getLteBands(): Promise<LteBands> {
  const [mode, list] = await Promise.all([
    routerClient.get<NetModeRaw>('/api/net/net-mode'),
    routerClient.get<NetModeListRaw>('/api/net/net-mode-list'),
  ]);
  const current = (mode.LTEBand ?? '').toUpperCase();
  const options = toArray(list.LTEBandList === '' ? undefined : list.LTEBandList?.LTEBand)
    .map((b) => (b.Value ?? '').toUpperCase())
    .filter((v) => HEX_MASK.test(v) && !sameMask(v, ALL_LTE_BANDS));
  if (!HEX_MASK.test(current)) throw new RouterError('invalid_response');
  return { current, supported: options[0] ?? current };
}

/**
 * Needs login. Limit the router to the bands in `mask` (hex). Same request as the web page
 * (mobilesearch.js saveUserSelect → net/net-mode): the current mode and 3G band with a new
 * LTEBand. The router re-registers on the network, which can take half a minute.
 * Dangerous: a band the operator doesn't use here means no internet until it is changed
 * back, so confirm + re-auth first. Never retried.
 */
export async function setLteBand(mask: string): Promise<void> {
  const value = mask.toUpperCase();
  if (!HEX_MASK.test(value) || bandsFromMask(value).length === 0) throw new RouterError('invalid_response');
  const mode = await routerClient.get<NetModeRaw>('/api/net/net-mode');
  await routerClient.post(
    '/api/net/net-mode',
    { NetworkMode: mode.NetworkMode ?? '03', NetworkBand: mode.NetworkBand ?? '3FFFFFFF', LTEBand: value },
    { retryBadToken: false, timeoutMs: 45000 },
  );
}
