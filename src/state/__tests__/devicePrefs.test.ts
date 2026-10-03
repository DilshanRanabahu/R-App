import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  forgetDevice,
  loadDevicePrefs,
  markKnown,
  resetDevicePrefsForTests,
  sanitizePrefs,
  updateDevice,
} from '../devicePrefs';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Fake devices only (AGENTS.md §9).
const MAC = '00:00:5E:00:53:01';
const OTHER = '00:00:5E:00:53:02';
const stored = async () => JSON.parse((await AsyncStorage.getItem('device_prefs_v1')) ?? '{}');

beforeEach(async () => {
  await AsyncStorage.clear();
  resetDevicePrefsForTests();
});

describe('sanitizePrefs', () => {
  it('keeps only valid MACs and known fields', () => {
    expect(
      sanitizePrefs({
        '00-00-5e-00-53-01': { nickname: '  TV  ', kind: 'tv', known: true, extra: 'x' },
        'not-a-mac': { nickname: 'x' },
        [OTHER]: { kind: 'spaceship', known: 'yes' },
        '00:00:5E:00:53:03': 'text',
      }),
    ).toEqual({ [MAC]: { nickname: 'TV', kind: 'tv', known: true } });
  });

  it('survives junk and trims long names', () => {
    expect(sanitizePrefs(null)).toEqual({});
    expect(sanitizePrefs('[]')).toEqual({});
    expect(sanitizePrefs({ [MAC]: { nickname: 'a'.repeat(80) } })[MAC]?.nickname).toHaveLength(32);
  });
});

describe('device prefs store', () => {
  it('saves a nickname and type, and clears a field with undefined', async () => {
    await updateDevice('00-00-5e-00-53-01', { nickname: 'TV', kind: 'tv', known: true });
    expect(await stored()).toEqual({ [MAC]: { nickname: 'TV', kind: 'tv', known: true } });
    await updateDevice(MAC, { nickname: undefined });
    expect(await stored()).toEqual({ [MAC]: { kind: 'tv', known: true } });
  });

  it('marks several devices as known and keeps their names', async () => {
    await updateDevice(MAC, { nickname: 'TV' });
    await markKnown([MAC, OTHER]);
    expect(await stored()).toEqual({ [MAC]: { nickname: 'TV', known: true }, [OTHER]: { known: true } });
  });

  it('forgets a device', async () => {
    await markKnown([MAC]);
    await forgetDevice(MAC);
    expect(await stored()).toEqual({});
  });

  it('starts empty when the stored data is corrupt', async () => {
    await AsyncStorage.setItem('device_prefs_v1', '{broken');
    await loadDevicePrefs();
    await markKnown([MAC]);
    expect(await stored()).toEqual({ [MAC]: { known: true } });
  });
});
