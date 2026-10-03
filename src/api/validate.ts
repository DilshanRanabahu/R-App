// Input validators (AGENTS.md §8.4). Each returns an error message, or null when valid.

export type Validation = string | null;

const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Only private IPv4 literals: 10/8, 172.16/12, 192.168/16. */
export function isPrivateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const parts = m.slice(1).map(Number);
  if (parts.some((p, i) => p > 255 || String(p) !== m[i + 1])) return false;
  const [a, b] = parts as [number, number, number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function validateRouterAddress(host: string): Validation {
  return isPrivateIPv4(host.trim()) ? null : 'Enter a local address like 192.168.8.1.';
}

/**
 * Wi-Fi name, already trimmed (the router trims it too). This router allows keyboard
 * characters only (chinesessid_enable=0, wifispecialcharenable=1), max 32.
 */
export function validateSsid(ssid: string): Validation {
  const len = utf8Length(ssid);
  if (len < 1) return 'Wi-Fi name is required.';
  if (len > 32) return 'Wi-Fi name must be 32 characters or less.';
  if (!PRINTABLE_ASCII.test(ssid)) return 'Use only English letters, numbers, spaces and symbols.';
  return null;
}

/** WPA2 key: 8–63 keyboard characters, not starting with a space (router web UI rule). */
export function validateWifiKey(key: string): Validation {
  if (key.length < 8 || key.length > 63) return 'Password must be 8–63 characters.';
  if (!PRINTABLE_ASCII.test(key)) return 'Use only English letters, numbers and symbols.';
  if (key.startsWith(' ')) return "Password can't start with a space.";
  return null;
}

export function validatePhoneNumber(phone: string): Validation {
  return /^\+?[0-9]{3,15}$/.test(phone.trim()) ? null : 'Enter a valid phone number.';
}

export function validateUssd(code: string): Validation {
  return /^[*#][*#0-9]{1,29}$/.test(code.trim()) ? null : 'USSD codes use only * # and digits.';
}

export const SMS_MAX_LENGTH = 459;

export function validateSmsText(text: string): Validation {
  const t = text.trim();
  if (t.length === 0) return 'Message is empty.';
  if (t.length > SMS_MAX_LENGTH) return `Message must be ${SMS_MAX_LENGTH} characters or less.`;
  return null;
}

export function normalizeMac(mac: string): string {
  return mac.trim().toUpperCase().replace(/-/g, ':');
}

export function validateMac(mac: string): Validation {
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(normalizeMac(mac)) ? null : 'Invalid MAC address.';
}

export const NICKNAME_MAX_LENGTH = 32;

/** Device nickname (app-side only, never sent to the router). Pass it trimmed. */
export function validateNickname(name: string): Validation {
  if (name.length === 0) return 'Enter a name.';
  if (name.length > NICKNAME_MAX_LENGTH) return `Name must be ${NICKNAME_MAX_LENGTH} characters or less.`;
  if (/[\u0000-\u001F\u007F]/.test(name)) return "Name can't contain line breaks or control characters.";
  return null;
}

/**
 * New admin password (AGENTS.md §8.2 + the router's own rules: 8+ characters,
 * keyboard characters 32–126 only, must not start with a space).
 */
export function validateNewAdminPassword(next: string, current: string): Validation {
  if (next.length < 8 || next.length > 32) return 'Password must be 8–32 characters.';
  if (!PRINTABLE_ASCII.test(next)) return 'Use only English letters, numbers and symbols.';
  if (next.startsWith(' ')) return "Password can't start with a space.";
  if (next === current) return 'New password must be different from the current one.';
  return null;
}

export type PasswordStrength = 'weak' | 'medium' | 'strong';

/** Strength hint only (not enforced): length + mix of lower, upper, digits, symbols. */
export function passwordStrength(password: string): PasswordStrength {
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(password)).length;
  if (password.length >= 12 && kinds >= 3) return 'strong';
  if (password.length >= 8 && kinds >= 2) return 'medium';
  return 'weak';
}
