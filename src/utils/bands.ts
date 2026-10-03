// LTE band masks as HiLink uses them (net/net-mode `LTEBand`): a hex bit mask where
// bit (n − 1) stands for band n. Band 3 = 0x4, bands 1 + 3 = 0x5.

const FREQUENCY: Record<number, string> = {
  1: '2100 MHz',
  3: '1800 MHz',
  5: '850 MHz',
  7: '2600 MHz',
  8: '900 MHz',
  20: '800 MHz',
  28: '700 MHz',
  38: '2600 MHz TDD',
  40: '2300 MHz TDD',
  41: '2500 MHz TDD',
};

/** "All bands" as the router lists it. */
export const ALL_LTE_BANDS = '7FFFFFFFFFFFFFFF';

function toBigInt(mask: string): bigint | null {
  return /^[0-9a-f]{1,16}$/i.test(mask) ? BigInt(`0x${mask}`) : null;
}

/** Band numbers in a mask, ascending. Empty for an invalid mask. */
export function bandsFromMask(mask: string): number[] {
  const value = toBigInt(mask);
  if (value === null) return [];
  const bands: number[] = [];
  for (let band = 1; band <= 64; band++) {
    if ((value >> BigInt(band - 1)) & 1n) bands.push(band);
  }
  return bands;
}

/** Upper-case hex mask with only this band set. */
export function maskForBand(band: number): string {
  if (!Number.isInteger(band) || band < 1 || band > 64) throw new Error('Invalid LTE band');
  return (1n << BigInt(band - 1)).toString(16).toUpperCase();
}

export function sameMask(a: string, b: string): boolean {
  const x = toBigInt(a);
  const y = toBigInt(b);
  return x !== null && y !== null && x === y;
}

/** "Band 3 · 1800 MHz" (frequency only for the common bands). */
export function bandLabel(band: number): string {
  const frequency = FREQUENCY[band];
  return frequency ? `Band ${band} · ${frequency}` : `Band ${band}`;
}

export type BandSelection = { kind: 'auto' } | { kind: 'single'; band: number } | { kind: 'custom'; bands: number[] };

/** What the current mask means, given the bands this router supports. */
export function describeSelection(current: string, supported: string): BandSelection {
  if (sameMask(current, supported) || sameMask(current, ALL_LTE_BANDS)) return { kind: 'auto' };
  const bands = bandsFromMask(current);
  const only = bands[0];
  if (bands.length === 1 && only !== undefined) return { kind: 'single', band: only };
  return { kind: 'custom', bands };
}
