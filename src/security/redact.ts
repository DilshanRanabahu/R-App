// AGENTS.md §8.9 — scrub secrets and personal data before anything is logged.

const SENSITIVE_TAGS = [
  'SesInfo',
  'TokInfo',
  'Password',
  'password',
  'Imei',
  'Imsi',
  'Iccid',
  'SerialNumber',
  'MacAddress',
  'MacAddress1',
  'MacAddress2',
  'Msisdn',
  'Phone',
  'Content',
  'WifiWpapsk',
  'MixWifiWpapsk',
  'WifiWepKey1',
  'WifiWepKey2',
  'WifiWepKey3',
  'WifiWepKey4',
  'WifiRadiusKey',
  'WifiSsid',
  'currentpassword',
  'newpassword',
  'nonce',
  'pwd',
  'hash',
  'encpubkeyn',
];

const TAG_PATTERN = new RegExp(`<(${SENSITIVE_TAGS.join('|')})>[^<]*</\\1>`, 'g');

export function redact(text: string): string {
  return text
    .replace(TAG_PATTERN, '<$1>[redacted]</$1>')
    .replace(/SessionID=[^;,\s]+/g, 'SessionID=[redacted]')
    .replace(/(__RequestVerificationToken\w*["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1[redacted]')
    .replace(/\b([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g, '[mac]')
    .replace(/\+?\b\d{9,15}\b/g, '[number]');
}

/** Dev-only logging; stripped from release builds by babel. */
export function devLog(message: string, detail?: unknown): void {
  if (!__DEV__) return;
  const text = detail === undefined ? '' : redact(detail instanceof Error ? detail.message : String(detail));
  console.log(`[r-app] ${message}`, text);
}
