import type { PostOptions } from '../client';
import { buildWifiSsid, getWifiNetwork, saveWifiNetwork } from '../endpoints/wifi';
import type { WifiSsidRaw } from '../types';
import { buildRequest, escapeLikeWifiUi } from '../xml';

// Fake network data only (AGENTS.md §9).
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../client', () => ({
  routerClient: {
    get: (path: string) => mockGet(path),
    post: (path: string, body: unknown, options: unknown) => mockPost(path, body, options),
  },
}));
const mockEncrypt = jest.fn((_plain: string, _key: unknown, _padding: string) => 'c0ffee');
jest.mock('../crypto', () => ({
  rsaEncryptHex: (plain: string, key: unknown, padding: string) => mockEncrypt(plain, key, padding),
  loginPasswordHash: jest.fn(),
  newSecretExchange: jest.fn(),
  decryptSecretReply: jest.fn(),
}));

const mockTrustedKey = jest.fn();
jest.mock('@/security/routerIdentity', () => ({ trustedPublicKey: () => mockTrustedKey() }));

// Same shape as this router's multi-basic-settings (values made up).
const MAIN: WifiSsidRaw = {
  WifiWepKey4: '',
  Index: '0',
  WifiAuthmode: 'WPA2-PSK',
  WifiWpaencryptionmodes: 'AES',
  WifiBroadcast: '0',
  WifiWepKey1: '',
  MixWifiWpapsk: '',
  WifiWpapsk: '',
  WifiMac: 'AA:BB:CC:DD:EE:01',
  WifiSsid: 'Old&#x2F;Name',
  wifiisguestnetwork: '0',
  ID: 'InternetGatewayDevice.X_Config.Wifi.Radio.1.Ssid.1.',
  WifiRadiusKey: '',
  wifisupportsecmodelist: '',
  WifiEnable: '1',
};
const GUEST: WifiSsidRaw = {
  ...MAIN,
  Index: '1',
  WifiAuthmode: 'OPEN',
  wifiisguestnetwork: '1',
  ID: 'InternetGatewayDevice.X_Config.Wifi.Radio.1.Ssid.2.',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockImplementation(async (path: string) => {
    if (path === '/api/wlan/multi-basic-settings') return { Ssids: { Ssid: [MAIN, GUEST] } };
    return { rsapadingtype: '1' }; // state-login
  });
  mockTrustedKey.mockResolvedValue({ n: 'abc', e: '010001' });
  mockPost.mockResolvedValue('OK');
});

describe('getWifiNetwork', () => {
  it('reads the main network, never the guest one', async () => {
    expect(await getWifiNetwork()).toEqual({
      ssid: 'Old/Name',
      enabled: true,
      hidden: false,
      security: 'WPA2-PSK',
    });
  });
});

describe('buildWifiSsid', () => {
  it('keeps field order, drops secrets and sets name / hidden / mode', () => {
    const entry = buildWifiSsid(MAIN, { ssid: 'New', hidden: true, newPassword: null }, null);
    expect(Object.keys(entry)).toEqual([
      'Index',
      'WifiAuthmode',
      'WifiWpaencryptionmodes',
      'WifiBroadcast',
      'WifiMac',
      'WifiSsid',
      'wifiisguestnetwork',
      'ID',
      'wifisupportsecmodelist',
      'WifiEnable',
    ]);
    expect(entry.WifiSsid).toBe('New');
    expect(entry.WifiBroadcast).toBe('1');
    expect(entry.WifiWpaencryptionmodes).toBe('AES');
    expect(entry).not.toHaveProperty('WifiWpapsk');
    expect(entry).not.toHaveProperty('WifiWepKey1');
    expect(entry).not.toHaveProperty('WifiRadiusKey');
  });

  it('puts the encrypted password in both key fields', () => {
    const entry = buildWifiSsid(MAIN, { ssid: 'N', hidden: false, newPassword: 'x' }, 'c0ffee');
    expect(entry.WifiWpapsk).toBe('c0ffee');
    expect(entry.MixWifiWpapsk).toBe('c0ffee');
  });
});

describe('saveWifiNetwork', () => {
  it('posts only the main entry like the router Wi-Fi page', async () => {
    await saveWifiNetwork({ ssid: "Home's (2)", hidden: false, newPassword: 'fake/Key(1)' });

    const [path, body, options] = mockPost.mock.calls[0] as [string, never, PostOptions];
    expect(path).toBe('/api/wlan/multi-basic-settings');
    expect(options).toMatchObject({ typeSuffix: 'enp', retryBadToken: false });
    expect(options.escape).toBe(escapeLikeWifiUi);
    // The password is escaped like the page's wifiEncode, then RSA-encrypted on its own.
    expect(mockEncrypt).toHaveBeenCalledWith('fake&#x2F;Key&#40;1&#41;', { n: 'abc', e: '010001' }, 'oaep');

    const xml = buildRequest(body, options.escape);
    expect(xml).toContain('<Ssids><Ssid><Index>0</Index>');
    expect(xml).toContain('<WifiSsid>Home&apos;s &#40;2&#41;</WifiSsid>');
    expect(xml).toContain('<WifiWpapsk>c0ffee</WifiWpapsk>');
    expect(xml).toContain('<MixWifiWpapsk>c0ffee</MixWifiWpapsk>');
    expect(xml).toContain('</Ssid></Ssids><WifiRestart>1</WifiRestart></request>');
    expect(xml).not.toContain('Ssid.2.');
  });

  it('leaves the password out when it is not changed', async () => {
    await saveWifiNetwork({ ssid: 'Same', hidden: false, newPassword: null });
    const [, body, options] = mockPost.mock.calls[0] as [string, never, PostOptions];
    expect(mockEncrypt).not.toHaveBeenCalled();
    expect(buildRequest(body, options.escape)).not.toContain('Wpapsk');
  });

  it('sends nothing when the key does not belong to the pinned router', async () => {
    mockTrustedKey.mockRejectedValue(new Error('identity_mismatch'));
    await expect(saveWifiNetwork({ ssid: 'X', hidden: false, newPassword: 'abcdefgh' })).rejects.toThrow();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('refuses a password change for non-WPA2 networks', async () => {
    mockGet.mockImplementation(async () => ({ Ssids: { Ssid: [{ ...MAIN, WifiAuthmode: 'WPA3-SAE' }] } }));
    await expect(saveWifiNetwork({ ssid: 'X', hidden: false, newPassword: 'abcdefgh' })).rejects.toThrow();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
