import { createHash } from 'crypto';

import { trustedPublicKey } from '../routerIdentity';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: async (_alg: string, data: string) =>
    jest.requireActual<typeof import('crypto')>('crypto').createHash('sha256').update(data, 'utf8').digest('hex'),
}));

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'x',
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void mockStore.set(key, value),
  deleteItemAsync: async (key: string) => void mockStore.delete(key),
}));

// Fake key material only.
const mockDevice = { name: 'B312-926', n: 'a1b2c3', e: '010001' };
jest.mock('@/api/endpoints/device', () => ({
  getBasicInformation: async () => ({ deviceName: mockDevice.name, marketingName: '' }),
  getPublicKey: async () => ({ encpubkeyn: mockDevice.n, encpubkeye: mockDevice.e }),
  getDeviceInformation: async () => ({}),
}));

const pin = (name: string, n: string, e: string) =>
  createHash('sha256').update(`${name}|${n}|${e}`).digest('hex');

beforeEach(() => {
  mockStore.clear();
  Object.assign(mockDevice, { name: 'B312-926', n: 'a1b2c3', e: '010001' });
});

describe('trustedPublicKey', () => {
  it('returns the key of the router pinned at login', async () => {
    mockStore.set('router_pin_pre_v1', pin('B312-926', 'a1b2c3', '010001'));
    await expect(trustedPublicKey()).resolves.toEqual({ n: 'a1b2c3', e: '010001' });
  });

  it('refuses a different key (look-alike router)', async () => {
    mockStore.set('router_pin_pre_v1', pin('B312-926', 'a1b2c3', '010001'));
    mockDevice.n = 'ffffff';
    await expect(trustedPublicKey()).rejects.toMatchObject({ kind: 'identity_mismatch' });
  });

  it('refuses when no router is pinned yet', async () => {
    await expect(trustedPublicKey()).rejects.toMatchObject({ kind: 'identity_mismatch' });
  });

  it('refuses when the router sends no key', async () => {
    mockDevice.n = '';
    await expect(trustedPublicKey()).rejects.toMatchObject({ kind: 'invalid_response' });
  });
});
