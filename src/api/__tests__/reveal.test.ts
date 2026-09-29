import { createCipheriv, createHmac, pbkdf2Sync } from 'crypto';

import { revealWifiPassword } from '../endpoints/wifi';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) =>
    new Uint8Array(jest.requireActual<typeof import('crypto')>('crypto').randomBytes(n)),
}));

// RSA is covered in rsa.test; here it passes the secrets through so the fake router can read them.
jest.mock('../crypto', () => ({
  ...jest.requireActual('../crypto'),
  rsaEncryptHex: (plain: string) => plain,
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../client', () => ({
  routerClient: {
    get: (path: string) => mockGet(path),
    post: (path: string, body: unknown) => mockPost(path, body),
  },
}));

// Fake keys only. The main key contains a numeric reference, as the router sends them.
const SETTINGS =
  '<response><Ssids>' +
  '<Ssid><Index>0</Index><ID>InternetGatewayDevice.X_Config.Wifi.Radio.1.Ssid.1.</ID><WifiWpapsk>fake&#40;main&#41;key</WifiWpapsk></Ssid>' +
  '<Ssid><Index>1</Index><ID>InternetGatewayDevice.X_Config.Wifi.Radio.1.Ssid.2.</ID><WifiWpapsk>guest-key</WifiWpapsk></Ssid>' +
  '</Ssids></response>';

/** Fake router side of user/pwd, following the web UI's derivation. */
function routerReply(secrets: string) {
  const nonceHex = secrets.slice(0, 64);
  const saltHex = secrets.slice(64);
  const iter = 50;
  const derived = pbkdf2Sync(nonceHex, Buffer.from(saltHex, 'hex'), iter, 32, 'sha256').toString('hex');
  const iv = Buffer.concat([Buffer.from(derived.slice(32, 48), 'hex'), Buffer.alloc(8)]);
  const cipher = createCipheriv('aes-128-cbc', Buffer.from(derived.slice(0, 32), 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(`<?xml version="1.0"?>${SETTINGS}`, 'utf8'), cipher.final()]);
  const hash = createHmac('sha256', Buffer.from(derived.slice(48, 64), 'hex')).update(encrypted).digest('hex');
  return { pwd: encrypted.toString('hex'), hash, iter: String(iter) };
}

beforeEach(() => {
  mockGet.mockImplementation(async (path: string) =>
    path === '/api/user/state-login' ? { rsapadingtype: '1' } : { encpubkeyn: 'ab', encpubkeye: '03' },
  );
  mockPost.mockImplementation(async (_path: string, body: { nonce: string }) => routerReply(body.nonce));
});

describe('revealWifiPassword', () => {
  it('runs the user/pwd exchange and returns the main network key', async () => {
    await expect(revealWifiPassword()).resolves.toBe('fake(main)key');
    const [path, body] = mockPost.mock.calls[0] as [string, { module: string; nonce: string }];
    expect(path).toBe('/api/user/pwd');
    expect(body.module).toBe('wlan');
    expect(body.nonce).toMatch(/^[0-9a-f]{128}$/);
  });

  it('refuses a reply with a wrong signature', async () => {
    mockPost.mockImplementation(async (_p: string, body: { nonce: string }) => ({
      ...routerReply(body.nonce),
      hash: '00'.repeat(32),
    }));
    await expect(revealWifiPassword()).rejects.toThrow();
  });
});
