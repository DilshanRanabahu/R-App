import * as Crypto from 'expo-crypto';

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
