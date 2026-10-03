import { OUI_BY_BRAND } from '../ouiData';
import { isPrivateMac, lookupVendor } from '../vendor';

// A real prefix from the bundled table, so the test doesn't depend on one hardcoded OUI.
const samsungPrefix = (OUI_BY_BRAND.Samsung ?? '').slice(0, 6);
const asMac = (prefix: string) => `${prefix.match(/../g)?.join(':')}:11:22:33`;

describe('lookupVendor', () => {
  it('finds the maker from the first half of the MAC', () => {
    expect(samsungPrefix).toHaveLength(6);
    expect(lookupVendor(asMac(samsungPrefix))).toBe('Samsung');
    expect(lookupVendor(asMac(samsungPrefix).toLowerCase().replace(/:/g, '-'))).toBe('Samsung');
  });

  it('returns null for private, unknown and malformed addresses', () => {
    expect(lookupVendor('DA:A1:19:00:00:01')).toBeNull(); // locally administered
    expect(lookupVendor('00:00:00:00:00:00')).toBeNull();
    expect(lookupVendor('not a mac')).toBeNull();
    expect(lookupVendor('')).toBeNull();
  });

  it('table has only well-formed prefixes', () => {
    for (const prefixes of Object.values(OUI_BY_BRAND)) {
      expect(prefixes).toMatch(/^([0-9A-F]{6})+$/);
    }
  });
});

describe('isPrivateMac', () => {
  it('detects the locally administered bit', () => {
    for (const mac of ['02:00:00:00:00:01', '06:11:22:33:44:55', 'AA:BB:CC:DD:EE:FF', 'fe:00:00:00:00:00']) {
      expect(isPrivateMac(mac)).toBe(true);
    }
    for (const mac of ['00:1A:2B:3C:4D:5E', 'A4:00:00:00:00:00', 'F8:11:22:33:44:55', '']) {
      expect(isPrivateMac(mac)).toBe(false);
    }
  });
});
