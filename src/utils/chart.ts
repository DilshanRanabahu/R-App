// Live speed chart helpers (FEATURES 2.8). Samples live in memory only.

export interface SpeedSample {
  /** ms timestamp of the router reading */
  t: number;
  /** bits per second */
  down: number;
  up: number;
}

export interface Point {
  x: number;
  y: number;
}

export const SPEED_WINDOW_MS = 60_000;
// Idle traffic is a few kbps; without a floor the chart would blow that noise up
// to full height.
const MIN_SCALE_BPS = 100_000;

/** Add a sample and drop the ones older than the window. Ignores repeats. */
export function appendSample(
  samples: SpeedSample[],
  sample: SpeedSample,
  windowMs = SPEED_WINDOW_MS,
): SpeedSample[] {
  const last = samples[samples.length - 1];
  if (last && sample.t <= last.t) return samples;
  return [...samples.filter((s) => sample.t - s.t <= windowMs), sample];
}

/** Round up to 1 / 2 / 5 × 10ⁿ so the scale label reads cleanly ("2 Mbps"). */
export function niceMax(value: number, floor = MIN_SCALE_BPS): number {
  const v = Math.max(value, floor);
  const exp = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 5, 10].find((m) => m * exp >= v) ?? 10;
  return step * exp;
}

export interface SpeedSummary {
  /** bits per second; null until there is at least one sample */
  topDown: number | null;
  topUp: number | null;
  avgDown: number | null;
  avgUp: number | null;
}

/** Top and average speed over the samples in the chart window. */
export function summarize(samples: SpeedSample[]): SpeedSummary {
  if (samples.length === 0) return { topDown: null, topUp: null, avgDown: null, avgUp: null };
  const sum = (key: 'down' | 'up') => samples.reduce((acc, s) => acc + s[key], 0);
  return {
    topDown: Math.max(...samples.map((s) => s.down)),
    topUp: Math.max(...samples.map((s) => s.up)),
    avgDown: sum('down') / samples.length,
    avgUp: sum('up') / samples.length,
  };
}

export interface AxisScale {
  unit: 'Mbps' | 'kbps';
  /** Labels for the top, middle and bottom grid lines. */
  ticks: [string, string, string];
}

const tick = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Y-axis labels for a niceMax() scale (bits per second): unit once, plain numbers per line. */
export function axisScale(maxBps: number): AxisScale {
  const mbps = maxBps >= 1_000_000;
  const top = mbps ? maxBps / 1_000_000 : maxBps / 1000;
  return { unit: mbps ? 'Mbps' : 'kbps', ticks: [tick(top), tick(top / 2), '0'] };
}

/**
 * Smooth SVG path through the points without overshoot (monotone cubic,
 * Fritsch–Butland tangents), so a speed never dips below zero or above a peak.
 * Points must have increasing x.
 */
export function monotonePath(points: Point[]): string {
  const n = points.length;
  const first = points[0];
  if (!first) return '';
  if (n === 1) return `M${first.x},${first.y}`;

  const h: number[] = [];
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    h.push(b.x - a.x);
    s.push((b.y - a.y) / (b.x - a.x));
  }

  const m: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) m.push(s[0] ?? 0);
    else if (i === n - 1) m.push(s[n - 2] ?? 0);
    else {
      const s0 = s[i - 1] ?? 0;
      const s1 = s[i] ?? 0;
      const h0 = h[i - 1] ?? 0;
      const h1 = h[i] ?? 0;
      m.push(s0 * s1 <= 0 ? 0 : (3 * (h0 + h1)) / ((2 * h1 + h0) / s0 + (h1 + 2 * h0) / s1));
    }
  }

  let d = `M${first.x},${first.y}`;
  for (let i = 0; i < n - 1; i++) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    const third = (h[i] ?? 0) / 3;
    const c1 = { x: a.x + third, y: a.y + (m[i] ?? 0) * third };
    const c2 = { x: b.x - third, y: b.y - (m[i + 1] ?? 0) * third };
    d += `C${c1.x},${c1.y},${c2.x},${c2.y},${b.x},${b.y}`;
  }
  return d;
}

/** Close a line path down to the baseline to fill the area under it. */
export function areaPath(points: Point[], baseline: number): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return '';
  return `${monotonePath(points)}L${last.x},${baseline}L${first.x},${baseline}Z`;
}

/** Map samples to chart coordinates; the newest sample sits at the right edge. */
export function toPoints(
  samples: SpeedSample[],
  key: 'down' | 'up',
  width: number,
  height: number,
  max: number,
  windowMs = SPEED_WINDOW_MS,
): Point[] {
  const now = samples[samples.length - 1]?.t ?? 0;
  return samples.map((sample) => ({
    x: width * (1 - (now - sample.t) / windowMs),
    y: height - (Math.min(sample[key], max) / max) * height,
  }));
}
