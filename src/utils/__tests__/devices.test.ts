import type { Host } from '@/api/types';
import {
  deviceIcon,
  deviceTitle,
  groupDevices,
  isKnown,
  isThisPhone,
  macToParam,
  paramToMac,
} from '../devices';
import { OUI_BY_BRAND } from '../ouiData';

// Fake devices only (AGENTS.md §9).
const host = (over: Partial<Host>): Host => ({
  mac: '00:00:5E:00:53:01',
  ip: '192.168.8.50',
  name: 'Unknown device',
  connectedSeconds: 0,
  connection: 'wifi',
  active: true,
  ...over,
});

const PHONE_IP = '192.168.8.100';
const phone = host({ mac: '00:00:5E:00:53:0A', ip: PHONE_IP, name: 'Galaxy-A06', connectedSeconds: 30 });
const laptop = host({
  mac: '00:00:5E:00:53:0B',
  ip: '192.168.8.102',
  name: 'My-Laptop',
  connection: 'cable',
  connectedSeconds: 900,
});
const stranger = host({ mac: '00:00:5E:00:53:0C', ip: '192.168.8.103', connectedSeconds: 60 });
const gone = host({ mac: '00:00:5E:00:53:0D', name: 'Old-Tablet', active: false, connection: 'unknown' });

describe('deviceTitle', () => {
  it('prefers the nickname, then the reported name', () => {
    expect(deviceTitle(laptop, { nickname: 'Work laptop' })).toBe('Work laptop');
    expect(deviceTitle(laptop, undefined)).toBe('My-Laptop');
  });

  it('falls back to the maker for unnamed devices', () => {
    const prefix = (OUI_BY_BRAND.Samsung ?? '').slice(0, 6).match(/../g)?.join(':');
    expect(deviceTitle(host({ mac: `${prefix}:00:00:01` }), undefined)).toBe('Samsung device');
    expect(deviceTitle(stranger, undefined)).toBe('Unknown device');
  });
});

describe('deviceIcon', () => {
  it('uses the chosen type, else guesses from the connection', () => {
    expect(deviceIcon(laptop, { kind: 'tv' }, false)).toBe('tv-outline');
    expect(deviceIcon(laptop, undefined, false)).toBe('desktop-outline');
    expect(deviceIcon(stranger, undefined, false)).toBe('wifi-outline');
    expect(deviceIcon(phone, undefined, true)).toBe('phone-portrait-outline');
  });
});

describe('known devices', () => {
  it('this phone is always known; others only when marked', () => {
    expect(isThisPhone(phone, PHONE_IP)).toBe(true);
    expect(isThisPhone(phone, null)).toBe(false);
    // A device that left and whose address the phone now has is not "this phone".
    expect(isThisPhone({ ...gone, ip: PHONE_IP }, PHONE_IP)).toBe(false);
    expect(isKnown(phone, undefined, true)).toBe(true);
    expect(isKnown(stranger, undefined, false)).toBe(false);
    expect(isKnown(stranger, { nickname: 'x' }, false)).toBe(false);
    expect(isKnown(stranger, { known: true }, false)).toBe(true);
  });
});

describe('groupDevices', () => {
  it('splits into new, connected and not connected', () => {
    const groups = groupDevices([gone, stranger, laptop, phone], { [laptop.mac]: { known: true } }, PHONE_IP);
    expect(groups.fresh).toEqual([stranger]);
    // This phone first, even though the laptop has been connected longer.
    expect(groups.online).toEqual([phone, laptop]);
    expect(groups.offline).toEqual([gone]);
  });

  it('a device that has left is never listed as new', () => {
    expect(groupDevices([gone], {}, PHONE_IP).fresh).toEqual([]);
  });

  it('blocked devices are listed only under Blocked, even if the router no longer lists them', () => {
    const missing = { mac: '00:00:5E:00:53:0E', name: 'Guest-Phone' };
    const groups = groupDevices([gone, stranger, phone], {}, PHONE_IP, [{ mac: gone.mac, name: 'x' }, missing]);
    expect(groups.offline).toEqual([]);
    expect(groups.blocked.map((h) => [h.name, h.active])).toEqual([
      ['Guest-Phone', false],
      ['Old-Tablet', false],
    ]);
    expect(groups.fresh).toEqual([stranger]);
  });

  it('trusts the router when it says which device is asking', () => {
    // No phone IP available: the router's own mark still identifies this phone.
    expect(isThisPhone({ ...phone, self: true }, null)).toBe(true);
    expect(groupDevices([{ ...phone, self: true }], {}, null).online).toHaveLength(1);
  });
});

describe('route parameter', () => {
  it('round-trips a MAC without colons', () => {
    expect(macToParam('aa:bb:cc:dd:ee:ff')).toBe('AA-BB-CC-DD-EE-FF');
    expect(paramToMac('AA-BB-CC-DD-EE-FF')).toBe('AA:BB:CC:DD:EE:FF');
  });

  it('rejects anything that is not a MAC (deep links are untrusted)', () => {
    expect(paramToMac('../login')).toBeNull();
    expect(paramToMac('AA-BB-CC')).toBeNull();
    expect(paramToMac(['AA-BB-CC-DD-EE-FF'])).toBeNull();
    expect(paramToMac(undefined)).toBeNull();
  });
});
