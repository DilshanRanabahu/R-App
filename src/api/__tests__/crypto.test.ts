import { createHash } from 'crypto';

import { loginPasswordHash } from '../crypto';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: async (_alg: string, data: string) =>
    jest.requireActual<typeof import('crypto')>('crypto')
      .createHash('sha256')
      .update(data, 'utf8')
      .digest('hex'),
}));

// Independent reference implementation of the HiLink password_type=4 scheme.
function reference(username: string, password: string, token: string): string {
  const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
  const b64 = (s: string) => Buffer.from(s, 'ascii').toString('base64');
  return b64(sha(username + b64(sha(password)) + token));
}

describe('loginPasswordHash', () => {
  // Fake credentials only (AGENTS.md §8.2).
  const cases: [string, string, string][] = [
    ['admin', 'example-password', 'AbCdEf0123456789AbCdEf0123456789'],
    ['admin', 'p@ss wörd', 'token'],
    ['user', '', 'x'],
  ];

  it.each(cases)('matches the reference for %s', async (u, p, t) => {
    await expect(loginPasswordHash(u, p, t)).resolves.toBe(reference(u, p, t));
  });

  it('depends on the token', async () => {
    const a = await loginPasswordHash('admin', 'example-password', 'one');
    const b = await loginPasswordHash('admin', 'example-password', 'two');
    expect(a).not.toBe(b);
  });
});
