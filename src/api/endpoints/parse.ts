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
