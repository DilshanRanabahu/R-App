// DESIGN.md §14: speeds in bits (Mbps), data in bytes with 1024 steps.

export interface ValueWithUnit {
  value: string;
  unit: string;
}

export function formatBytes(bytes: number): ValueWithUnit {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = Math.max(0, bytes);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = i === 0 || v >= 100 ? 0 : 1;
  return { value: v.toFixed(digits), unit: units[i] ?? 'B' };
}

export function formatRate(bytesPerSecond: number): ValueWithUnit {
  const bits = Math.max(0, bytesPerSecond) * 8;
  if (bits >= 1_000_000) return { value: (bits / 1_000_000).toFixed(1), unit: 'Mbps' };
  return { value: (bits / 1000).toFixed(bits >= 100_000 ? 0 : 1), unit: 'kbps' };
}

export function joinUnit({ value, unit }: ValueWithUnit): string {
  return `${value} ${unit}`;
}

/** 45 s · 13 min · 2 h 10 min · 3 d 4 h */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}
