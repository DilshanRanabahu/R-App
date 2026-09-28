import type { Tone } from '@/theme';

// DESIGN.md §3 signal thresholds.
export type SignalRating = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

const ORDER: SignalRating[] = ['excellent', 'good', 'fair', 'poor'];

function rate(value: number | null, excellent: number, good: number, fair: number): SignalRating {
  if (value === null) return 'unknown';
  if (value >= excellent) return 'excellent';
  if (value >= good) return 'good';
  if (value >= fair) return 'fair';
  return 'poor';
}

export const rateRsrp = (v: number | null) => rate(v, -80, -90, -100);
export const rateSinr = (v: number | null) => rate(v, 20, 13, 0);
export const rateRsrq = (v: number | null) => rate(v, -10, -15, -20);

/** Overall = the worse of RSRP and SINR. */
export function overallRating(rsrp: number | null, sinr: number | null): SignalRating {
  const known = [rateRsrp(rsrp), rateSinr(sinr)].filter((r) => r !== 'unknown');
  if (known.length === 0) return 'unknown';
  return known.reduce((worst, r) => (ORDER.indexOf(r) > ORDER.indexOf(worst) ? r : worst));
}

export const RATING_LABEL: Record<SignalRating, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  unknown: 'Unknown',
};

export const RATING_TONE: Record<SignalRating, Tone> = {
  excellent: 'success',
  good: 'success',
  fair: 'warning',
  poor: 'danger',
  unknown: 'neutral',
};

export const RATING_BARS: Record<SignalRating, number> = {
  excellent: 4,
  good: 3,
  fair: 2,
  poor: 1,
  unknown: 0,
};

export const RATING_SENTENCE: Record<SignalRating, string> = {
  excellent: 'Your 4G signal is excellent.',
  good: 'Your 4G signal is good.',
  fair: 'Your signal is fair. Moving the router near a window may help.',
  poor: 'Your signal is poor. Try moving the router to a higher place or near a window.',
  unknown: 'Signal information is not available.',
};
