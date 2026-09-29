import { changeAdminPassword } from '../auth';
import type { PostOptions } from '../client';
import { buildRequest, escapeLikeWebUi } from '../xml';

// Fake passwords and key only (AGENTS.md §8.2).
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../client', () => ({
  routerClient: {
    get: (path: string) => mockGet(path),
    post: (path: string, body: unknown, options: unknown) => mockPost(path, body, options),
  },
}));
const mockEncrypt = jest.fn((_xml: string, _key: unknown, _padding: string) => 'deadbeef');
jest.mock('../crypto', () => ({
  rsaEncryptHex: (xml: string, key: unknown, padding: string) => mockEncrypt(xml, key, padding),
  loginPasswordHash: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockImplementation(async (path: string) =>
    path === '/api/user/state-login'
      ? { password_type: '4', rsapadingtype: '1', State: '0' }
      : { encpubkeyn: 'abc123', encpubkeye: '010001' },
  );
  mockPost.mockResolvedValue('OK');
});

describe('changeAdminPassword', () => {
  it('posts what the router web UI posts, RSA-encrypted, without retry', async () => {
    await changeAdminPassword('old-Fake(1)', "new/Fake'2&x");

    const [path, body, options] = mockPost.mock.calls[0] as [string, object, PostOptions];
    expect(path).toBe('/api/user/password_scram');
    expect(options.retryBadToken).toBe(false);
    expect(options.escape).toBe(escapeLikeWebUi);

    // Same element order and escaping as the web UI's xss() + object2xml.
    const xml = buildRequest(body as never, options.escape);
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><request><username>admin</username>' +
        '<currentpassword>old-Fake&#40;1&#41;</currentpassword>' +
        '<newpassword>new&#x2F;Fake&#39;2&amp;x</newpassword></request>',
    );

    expect(await options.encrypt?.(xml)).toBe('deadbeef');
    expect(mockEncrypt).toHaveBeenCalledWith(xml, { n: 'abc123', e: '010001' }, 'oaep');
  });

  it('uses PKCS#1 when the router asks for it', async () => {
    mockGet.mockImplementation(async (path: string) =>
      path === '/api/user/state-login' ? { rsapadingtype: '0' } : { encpubkeyn: 'ab', encpubkeye: '03' },
    );
    await changeAdminPassword('a', 'b');
    const options = mockPost.mock.calls[0]?.[2] as PostOptions;
    await options.encrypt?.('x');
    expect(mockEncrypt).toHaveBeenCalledWith('x', { n: 'ab', e: '03' }, 'pkcs1');
  });

  it('refuses to send without the router public key', async () => {
    mockGet.mockImplementation(async (path: string) => (path === '/api/user/state-login' ? {} : {}));
    await expect(changeAdminPassword('a', 'b')).rejects.toThrow();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
