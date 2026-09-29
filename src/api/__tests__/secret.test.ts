import { createCipheriv, createHmac, pbkdf2Sync } from 'crypto';

import { decryptSecretReply, newSecretExchange } from '../crypto';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) =>
    new Uint8Array(jest.requireActual<typeof import('crypto')>('crypto').randomBytes(n)),
}));

/**
 * Independent "router side" using Node's crypto, following the web UI's getWlanPwd
 * derivation (PBKDF2-SHA256 → AES-128-CBC key / 8-byte IV + zeros / HMAC key).
 */
function routerReply(nonceHex: string, saltHex: string, iter: number, plain: string) {
  const derived = pbkdf2Sync(nonceHex, Buffer.from(saltHex, 'hex'), iter, 32, 'sha256').toString('hex');
  const key = Buffer.from(derived.slice(0, 32), 'hex');
  const iv = Buffer.concat([Buffer.from(derived.slice(32, 48), 'hex'), Buffer.alloc(8)]);
  const hmacKey = Buffer.from(derived.slice(48, 64), 'hex');
  const cipher = createCipheriv('aes-128-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return {
    pwd: encrypted.toString('hex'),
    hash: createHmac('sha256', hmacKey).update(encrypted).digest('hex'),
    iter,
  };
}

// Fake Wi-Fi key only (AGENTS.md §8.2).
const PLAIN =
  '<?xml version="1.0" encoding="UTF-8"?><response><Ssids><Ssid><Index>0</Index>' +
  '<WifiWpapsk>fake-Key(1)/x</WifiWpapsk></Ssid></Ssids></response>';

describe('newSecretExchange', () => {
  it('makes two fresh 32-byte hex secrets', () => {
    const a = newSecretExchange();
    const b = newSecretExchange();
    expect(a.nonceHex).toMatch(/^[0-9a-f]{64}$/);
    expect(a.saltHex).toMatch(/^[0-9a-f]{64}$/);
    expect(a.nonceHex).not.toBe(b.nonceHex);
  });
});

describe('decryptSecretReply', () => {
  const ex = newSecretExchange();

  it('decrypts a reply built the web UI way', () => {
    const out = decryptSecretReply(ex, routerReply(ex.nonceHex, ex.saltHex, 100, PLAIN));
    expect(out.startsWith('<response>')).toBe(true);
    expect(out).toContain('<WifiWpapsk>fake-Key(1)/x</WifiWpapsk>');
  });

  it('rejects a tampered ciphertext or signature', () => {
    const reply = routerReply(ex.nonceHex, ex.saltHex, 100, PLAIN);
    const flipped = (reply.pwd[0] === 'a' ? 'b' : 'a') + reply.pwd.slice(1);
    expect(() => decryptSecretReply(ex, { ...reply, pwd: flipped })).toThrow('bad_signature');
    expect(() => decryptSecretReply(ex, { ...reply, hash: '00'.repeat(32) })).toThrow('bad_signature');
  });

  it('fails for a reply meant for other secrets', () => {
    const other = newSecretExchange();
    const reply = routerReply(other.nonceHex, other.saltHex, 100, PLAIN);
    expect(() => decryptSecretReply(ex, reply)).toThrow();
  });
});
