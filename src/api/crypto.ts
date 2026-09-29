import * as Crypto from 'expo-crypto';
import forge from 'node-forge';

export function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

/** Base64 of an ASCII string (inputs here are hex digests). */
export function base64Ascii(input: string): string {
  return btoa(input);
}

/**
 * HiLink login hash for password_type=4:
 * base64(sha256_hex(username + base64(sha256_hex(password)) + token))
 */
export async function loginPasswordHash(
  username: string,
  password: string,
  token: string,
): Promise<string> {
  const inner = base64Ascii(await sha256Hex(password));
  return base64Ascii(await sha256Hex(username + inner + token));
}

export type RsaPadding = 'oaep' | 'pkcs1';

export interface RsaPublicKeyHex {
  n: string; // modulus, hex (webserver/publickey encpubkeyn)
  e: string; // exponent, hex (encpubkeye)
}

/** Secure random bytes as a binary string (node-forge's format). */
function randomBinary(count: number): string {
  return String.fromCharCode(...Crypto.getRandomBytes(count));
}

/** PKCS#1 v1.5 type-2 padding: 00 02 <non-zero random> 00 <message>. */
function pkcs1v15Pad(message: string, keyBytes: number): string {
  const psLength = keyBytes - message.length - 3;
  let ps = '';
  while (ps.length < psLength) {
    for (const b of Crypto.getRandomBytes(psLength - ps.length)) {
      if (b !== 0) ps += String.fromCharCode(b);
    }
  }
  return `\x00\x02${ps}\x00${message}`;
}

/**
 * Largest base64 block the web UI puts in one RSA block: key size minus the padding
 * overhead (OAEP with SHA-1: 2·20 + 2; PKCS#1 v1.5: 11). 214 / 245 for 2048-bit keys.
 */
export function rsaBlockSize(keyBytes: number, padding: RsaPadding): number {
  return padding === 'oaep' ? keyBytes - 42 : keyBytes - 11;
}

/**
 * Encrypt a request body the way the router's web UI does (doRSAEncrypt):
 * base64(UTF-8 text), split into blocks, RSA each block, concatenate as hex.
 * OAEP uses SHA-1 like the UI's jsrsasign default (`rsapadingtype` 1).
 */
export function rsaEncryptHex(plain: string, key: RsaPublicKeyHex, padding: RsaPadding): string {
  const { BigInteger } = forge.jsbn;
  const publicKey = forge.pki.setRsaPublicKey(new BigInteger(key.n, 16), new BigInteger(key.e, 16));
  const keyBytes = Math.ceil(publicKey.n.bitLength() / 8);
  const size = rsaBlockSize(keyBytes, padding);
  const text = forge.util.encode64(forge.util.encodeUtf8(plain));
  let hex = '';
  for (let i = 0; i < text.length; i += size) {
    const block = text.slice(i, i + size);
    const cipher =
      padding === 'oaep'
        ? publicKey.encrypt(block, 'RSA-OAEP', { seed: randomBinary(20) })
        : publicKey.encrypt(pkcs1v15Pad(block, keyBytes), 'RAW');
    hex += forge.util.bytesToHex(cipher);
  }
  return hex;
}

/** One-time secrets for reading the Wi-Fi password (web UI: two SCRAM nonces, hex). */
export interface SecretExchange {
  nonceHex: string;
  saltHex: string;
}

export function newSecretExchange(): SecretExchange {
  const hex = () => forge.util.bytesToHex(randomBinary(32));
  return { nonceHex: hex(), saltHex: hex() };
}

export interface SecretReply {
  pwd: string; // AES-CBC ciphertext, hex
  hash: string; // HMAC-SHA256 of the ciphertext, hex
  iter: number; // PBKDF2 iterations
}

/**
 * Decrypt the router's user/pwd reply exactly like the web UI (guide.js getWlanPwd):
 * PBKDF2-HMAC-SHA256(password = nonce hex text, salt = salt bytes, iter, 32 bytes) →
 * hex; AES-128 key = hex[0:32], IV = hex[32:48] (8 bytes; CryptoJS treats the missing
 * half as zeros), HMAC key = hex[48:64]. The HMAC is checked before decrypting.
 * Returns the decrypted XML from "<response>" on.
 */
export function decryptSecretReply(exchange: SecretExchange, reply: SecretReply): string {
  const derived = forge.util.bytesToHex(
    forge.pkcs5.pbkdf2(
      exchange.nonceHex,
      forge.util.hexToBytes(exchange.saltHex),
      reply.iter,
      32,
      forge.md.sha256.create(),
    ),
  );
  const aesKey = forge.util.hexToBytes(derived.slice(0, 32));
  const iv = forge.util.hexToBytes(derived.slice(32, 48)) + String.fromCharCode(0).repeat(8);
  const hmacKey = forge.util.hexToBytes(derived.slice(48, 64));
  const cipherBytes = forge.util.hexToBytes(reply.pwd);

  const mac = forge.hmac.create();
  mac.start('sha256', hmacKey);
  mac.update(cipherBytes);
  if (mac.digest().toHex() !== reply.hash.toLowerCase()) throw new Error('bad_signature');

  const decipher = forge.cipher.createDecipher('AES-CBC', aesKey);
  decipher.start({ iv });
  decipher.update(forge.util.createBuffer(cipherBytes));
  if (!decipher.finish()) throw new Error('bad_padding');
  const text = decipher.output.getBytes();
  const start = text.indexOf('<response>');
  if (start < 0) throw new Error('no_response');
  return forge.util.decodeUtf8(text.slice(start));
}
