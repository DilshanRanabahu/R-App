import forge from 'node-forge';

import { rsaBlockSize, rsaEncryptHex } from '../crypto';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) =>
    new Uint8Array(jest.requireActual<typeof import('crypto')>('crypto').randomBytes(n)),
}));

// A throwaway test key (1024-bit keeps the test fast; the router uses 2048).
const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
const publicHex = { n: keys.publicKey.n.toString(16), e: keys.publicKey.e.toString(16) };
const keyBytes = 128;

/** Undo the web UI scheme: split hex into key-size blocks, decrypt, join, base64-decode. */
function decrypt(hex: string, scheme: 'RSA-OAEP' | 'RSAES-PKCS1-V1_5'): string {
  const blocks = hex.match(new RegExp(`.{${keyBytes * 2}}`, 'g')) ?? [];
  expect(blocks.join('')).toBe(hex);
  const b64 = blocks.map((b) => keys.privateKey.decrypt(forge.util.hexToBytes(b), scheme)).join('');
  return forge.util.decodeUtf8(forge.util.decode64(b64));
}

describe('rsaBlockSize', () => {
  it('matches the web UI block sizes for 2048-bit keys', () => {
    expect(rsaBlockSize(256, 'oaep')).toBe(214);
    expect(rsaBlockSize(256, 'pkcs1')).toBe(245);
  });
});

describe('rsaEncryptHex', () => {
  // Long enough to need several blocks; includes non-ASCII to check UTF-8 handling.
  const body = `<?xml version="1.0" encoding="UTF-8"?><request>${'<x>fake-välue</x>'.repeat(20)}</request>`;

  it('round-trips with OAEP (SHA-1), in fixed-size hex blocks', () => {
    const hex = rsaEncryptHex(body, publicHex, 'oaep');
    expect(hex).toMatch(/^[0-9a-f]+$/);
    expect(hex.length % (keyBytes * 2)).toBe(0);
    expect(hex.length / (keyBytes * 2)).toBeGreaterThan(1);
    expect(decrypt(hex, 'RSA-OAEP')).toBe(body);
  });

  it('round-trips with PKCS#1 v1.5', () => {
    expect(decrypt(rsaEncryptHex(body, publicHex, 'pkcs1'), 'RSAES-PKCS1-V1_5')).toBe(body);
  });

  it('uses fresh randomness each time', () => {
    expect(rsaEncryptHex('same', publicHex, 'oaep')).not.toBe(rsaEncryptHex('same', publicHex, 'oaep'));
  });
});
