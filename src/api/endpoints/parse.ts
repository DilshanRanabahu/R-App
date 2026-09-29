export function toNumber(value: string | undefined, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Signal values come as "-86dBm", "-11.0dB", ">=-51dBm" or "". */
export function toSignalValue(value: string | undefined): number | null {
  if (!value) return null;
  const m = /-?\d+(\.\d+)?/.exec(value);
  return m ? Number(m[0]) : null;
}

const LIMIT_UNITS: Record<string, number> = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };

/** Data plan limits come as "60GB" / "500MB" (1024 steps, like the router UI). */
export function toByteLimit(value: string | undefined): number {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)\s*$/i.exec(value ?? '');
  if (!m?.[1] || !m[2]) return 0;
  return Number(m[1]) * (LIMIT_UNITS[m[2].toUpperCase()] ?? 0);
}

/** "2026-09-26" → local midnight of that day, or null. */
export function toLocalDate(value: string | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * HiLink sends some text with numeric character references still in it, e.g. the
 * firmware "11.0.1.1&#40;H197SP2C1353&#41;". Decode only those (not named/DTD
 * entities, AGENTS.md §8.4) and never to control characters. Display text only.
 */
export function decodeCharRefs(value: string): string {
  return value.replace(/&#(x[0-9a-f]{1,6}|[0-9]{1,7});/gi, (ref, body: string) => {
    const code = body[0] === 'x' || body[0] === 'X' ? parseInt(body.slice(1), 16) : Number(body);
    const printable = code >= 0x20 && code !== 0x7f && !(code >= 0x80 && code < 0xa0) && code <= 0x10ffff;
    return printable && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : ref;
  });
}
