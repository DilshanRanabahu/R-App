import { ALL_LTE_BANDS, bandLabel, bandsFromMask, describeSelection, maskForBand, sameMask } from '../bands';

// The band set a B312-926 reports as its own.
const SUPPORTED = 'A000000095';

describe('LTE band masks', () => {
  it('reads band numbers from a mask (bit n − 1 = band n)', () => {
    expect(bandsFromMask(SUPPORTED)).toEqual([1, 3, 5, 8, 38, 40]);
    expect(bandsFromMask('a000000095')).toEqual([1, 3, 5, 8, 38, 40]);
    expect(bandsFromMask('4')).toEqual([3]);
    expect(bandsFromMask(ALL_LTE_BANDS)).toHaveLength(63);
  });

  it('rejects anything that is not a hex mask', () => {
    expect(bandsFromMask('')).toEqual([]);
    expect(bandsFromMask('xyz')).toEqual([]);
    expect(bandsFromMask('1'.repeat(17))).toEqual([]);
  });

  it('builds a single-band mask and round-trips it', () => {
    expect(maskForBand(1)).toBe('1');
    expect(maskForBand(3)).toBe('4');
    expect(maskForBand(40)).toBe('8000000000');
    for (const band of [1, 3, 5, 8, 38, 40]) expect(bandsFromMask(maskForBand(band))).toEqual([band]);
    expect(() => maskForBand(0)).toThrow();
    expect(() => maskForBand(65)).toThrow();
    expect(() => maskForBand(2.5)).toThrow();
  });

  it('compares masks by value, not text', () => {
    expect(sameMask('a000000095', 'A000000095')).toBe(true);
    expect(sameMask('04', '4')).toBe(true);
    expect(sameMask('4', '5')).toBe(false);
    expect(sameMask('', '')).toBe(false);
  });

  it('names what the current setting means', () => {
    expect(describeSelection(SUPPORTED, SUPPORTED)).toEqual({ kind: 'auto' });
    expect(describeSelection(ALL_LTE_BANDS, SUPPORTED)).toEqual({ kind: 'auto' });
    expect(describeSelection('4', SUPPORTED)).toEqual({ kind: 'single', band: 3 });
    expect(describeSelection('5', SUPPORTED)).toEqual({ kind: 'custom', bands: [1, 3] });
  });

  it('labels common bands with their frequency', () => {
    expect(bandLabel(3)).toBe('Band 3 · 1800 MHz');
    expect(bandLabel(40)).toBe('Band 40 · 2300 MHz TDD');
    expect(bandLabel(13)).toBe('Band 13');
  });
});
