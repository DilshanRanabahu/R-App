import { getRebootSchedule, setRebootScheduleEnabled } from '../endpoints/device';
import { getLteBands, setLteBand } from '../endpoints/net';
import {
  buildGuestSsid,
  buildGuestSwitch,
  extendGuestTime,
  getGuestNetwork,
  saveGuestNetwork,
  setGuestEnabled,
} from '../endpoints/wifi';
import type { WifiSsidRaw } from '../types';

// Reboot schedule, LTE band and guest Wi-Fi. Shapes follow the router's own answers;
// names and addresses are fake (AGENTS.md §9).
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../client', () => ({
  routerClient: {
    get: (path: string) => mockGet(path),
    post: (path: string, body: unknown, options: unknown) => mockPost(path, body, options),
  },
}));
jest.mock('@/security/routerIdentity', () => ({
  trustedPublicKey: jest.fn(async () => ({ n: 'n', e: 'e' })),
}));
jest.mock('../auth', () => ({ getLoginState: jest.fn(async () => ({ rsaPadding: 'oaep' })) }));
jest.mock('../crypto', () => ({
  rsaEncryptHex: (plain: string) => `RSA(${plain})`,
  newSecretExchange: jest.fn(),
  decryptSecretReply: jest.fn(),
}));

const main: WifiSsidRaw = {
  Index: '0',
  ID: 'InternetGatewayDevice.X_Config.Wifi.Radio.1.Ssid.1.',
  WifiSsid: 'Home-WiFi',
  WifiEnable: '1',
  WifiAuthmode: 'WPA2-PSK',
  WifiWpapsk: '',
  WifiWepKey1: '',
  wifiisguestnetwork: '0',
};
const guest: WifiSsidRaw = {
  Index: '1',
  ID: 'InternetGatewayDevice.X_Config.Wifi.Radio.1.Ssid.2.',
  WifiSsid: 'Home-Guest',
  WifiEnable: '0',
  WifiAuthmode: 'OPEN',
  WifiBasicencryptionmodes: 'NONE',
  WifiWpapsk: '',
  MixWifiWpapsk: '',
  WifiWepKey1: '',
  WifiBroadcast: '0',
  wifiisguestnetwork: '1',
  wifiguestofftime: '4',
};

function respond(routes: Record<string, unknown>) {
  mockGet.mockImplementation(async (path: string) => {
    if (!(path in routes)) throw new Error(`unexpected GET ${path}`);
    return routes[path];
  });
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset().mockResolvedValue('OK');
});

describe('automatic restart (diagnosis/time_reboot)', () => {
  const raw = { enable: '1', dayinterval: '7', begintime: '60', endtime: '300' };

  it('reads the schedule', async () => {
    respond({ '/api/diagnosis/time_reboot': raw });
    await expect(getRebootSchedule()).resolves.toEqual({ enabled: true, everyDays: 7, fromMinute: 60, toMinute: 300 });
  });

  it('switches it off by sending the same settings back with enable flipped', async () => {
    respond({ '/api/diagnosis/time_reboot': raw });
    await setRebootScheduleEnabled(false);
    expect(mockPost).toHaveBeenCalledWith(
      '/api/diagnosis/time_reboot',
      { enable: 0, dayinterval: '7', begintime: '60', endtime: '300' },
      { retryBadToken: false },
    );
  });
});

describe('LTE band (net/net-mode)', () => {
  const mode = { NetworkMode: '03', NetworkBand: '100000000C680380', LTEBand: 'A000000095' };
  const list = {
    LTEBandList: { LTEBand: [{ Name: '', Value: 'a000000095' }, { Name: 'All bands', Value: '7fffffffffffffff' }] },
  };

  it('reads the current mask and the router\'s own band set', async () => {
    respond({ '/api/net/net-mode': { ...mode, LTEBand: '4' }, '/api/net/net-mode-list': list });
    await expect(getLteBands()).resolves.toEqual({ current: '4', supported: 'A000000095' });
  });

  it('falls back to the current mask when the list has only "All bands"', async () => {
    respond({
      '/api/net/net-mode': mode,
      '/api/net/net-mode-list': { LTEBandList: { LTEBand: { Name: 'All bands', Value: '7fffffffffffffff' } } },
    });
    await expect(getLteBands()).resolves.toEqual({ current: 'A000000095', supported: 'A000000095' });
  });

  it('keeps mode and 3G band, changes only LTEBand, waits longer and never retries', async () => {
    respond({ '/api/net/net-mode': mode });
    await setLteBand('4');
    expect(mockPost).toHaveBeenCalledWith(
      '/api/net/net-mode',
      { NetworkMode: '03', NetworkBand: '100000000C680380', LTEBand: '4' },
      { retryBadToken: false, timeoutMs: 45000 },
    );
  });

  it('refuses an empty or malformed mask without calling the router', async () => {
    await expect(setLteBand('0')).rejects.toMatchObject({ kind: 'invalid_response' });
    await expect(setLteBand('<x>')).rejects.toMatchObject({ kind: 'invalid_response' });
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe('guest Wi-Fi', () => {
  const basic = { Ssids: { Ssid: [main, guest] } };
  const time = { extendtime: '30', isvalidtime: '1', remaintime: '7200' };

  it('reads the guest network', async () => {
    respond({ '/api/wlan/multi-basic-settings': basic, '/api/wlan/guesttime-setting': time });
    await expect(getGuestNetwork()).resolves.toEqual({
      ssid: 'Home-Guest',
      enabled: false,
      open: true,
      offTime: '4',
      remainSeconds: 7200,
      extendMinutes: 30,
    });
  });

  it('returns null when the router has no guest network', async () => {
    respond({ '/api/wlan/multi-basic-settings': { Ssids: { Ssid: main } }, '/api/wlan/guesttime-setting': time });
    await expect(getGuestNetwork()).resolves.toBeNull();
  });

  it('switch: sends every SSID without names or secrets, only the guest flag changed', () => {
    const [mainOut, guestOut] = buildGuestSwitch([main, guest], true);
    expect(mainOut).toEqual({
      Index: '0',
      ID: 'InternetGatewayDevice.X_Config.Wifi.Radio.1.Ssid.1.',
      WifiEnable: '1',
      WifiAuthmode: 'WPA2-PSK',
      wifiisguestnetwork: '0',
    });
    expect(guestOut).toMatchObject({ WifiEnable: '1', wifiisguestnetwork: '1', WifiAuthmode: 'OPEN' });
    expect(guestOut).not.toHaveProperty('WifiSsid');
    expect(guestOut).not.toHaveProperty('WifiWpapsk');
  });

  it('switch: plain POST with WifiRestart, never retried', async () => {
    respond({ '/api/wlan/multi-basic-settings': basic });
    await setGuestEnabled(true);
    const [path, body, options] = mockPost.mock.calls[0] as [string, { Ssids: { Ssid: object[] }; WifiRestart: number }, object];
    expect(path).toBe('/api/wlan/multi-basic-settings');
    expect(body.WifiRestart).toBe(1);
    expect(body.Ssids.Ssid).toHaveLength(2);
    expect(options).toEqual({ retryBadToken: false });
  });

  it('save with a password: WPA/WPA2, MIX, RSA-encrypted key in both fields', () => {
    const entry = buildGuestSsid(
      guest,
      { ssid: 'Visitors', open: false, newPassword: 'ignored-here', offTime: '24' },
      'ENCRYPTED',
    );
    expect(entry).toMatchObject({
      WifiSsid: 'Visitors',
      WifiAuthmode: 'WPA/WPA2-PSK',
      WifiWpaencryptionmodes: 'MIX',
      WifiWpapsk: 'ENCRYPTED',
      MixWifiWpapsk: 'ENCRYPTED',
      wifiguestofftime: '24',
      wifiisguestnetwork: '1',
    });
    expect(entry).not.toHaveProperty('WifiBasicencryptionmodes');
    expect(entry).not.toHaveProperty('WifiWepKey1');
  });

  it('save as open: no key fields at all', () => {
    const withKey = { ...guest, WifiAuthmode: 'WPA/WPA2-PSK', WifiWpaencryptionmodes: 'MIX' };
    const entry = buildGuestSsid(withKey, { ssid: 'Visitors', open: true, newPassword: null, offTime: '0' }, null);
    expect(entry).toMatchObject({ WifiAuthmode: 'OPEN', WifiBasicencryptionmodes: 'NONE', wifiguestofftime: '0' });
    expect(entry).not.toHaveProperty('WifiWpapsk');
    expect(entry).not.toHaveProperty('MixWifiWpapsk');
    expect(entry).not.toHaveProperty('WifiWpaencryptionmodes');
  });

  it('save: only the guest entry, ";enp", key encrypted with the pinned router key', async () => {
    respond({ '/api/wlan/multi-basic-settings': basic });
    await saveGuestNetwork({ ssid: 'Visitors', open: false, newPassword: "pass'word", offTime: '4' });
    const [path, body, options] = mockPost.mock.calls[0] as [
      string,
      { Ssids: { Ssid: Record<string, string>[] }; WifiRestart: number },
      { typeSuffix: string; retryBadToken: boolean },
    ];
    expect(path).toBe('/api/wlan/multi-basic-settings');
    expect(body.Ssids.Ssid).toHaveLength(1);
    expect(body.Ssids.Ssid[0]?.WifiWpapsk).toBe('RSA(pass&apos;word)');
    expect(body.WifiRestart).toBe(1);
    expect(options).toMatchObject({ typeSuffix: 'enp', retryBadToken: false });
  });

  it('refuses to add password protection without a password', async () => {
    respond({ '/api/wlan/multi-basic-settings': basic });
    await expect(
      saveGuestNetwork({ ssid: 'Visitors', open: false, newPassword: null, offTime: '4' }),
    ).rejects.toMatchObject({ kind: 'invalid_response' });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('extends the time', async () => {
    await extendGuestTime(30);
    expect(mockPost).toHaveBeenCalledWith('/api/wlan/guesttime-setting', { extendtime: 30 }, { retryBadToken: false });
  });
});
