import type { Tone } from '@/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** "26 Sep" */
export function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()] ?? ''}`;
}

function clampedDay(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

/** Local start of the current billing month for a plan that resets on `startDay`. */
export function periodStart(startDay: number, now: Date): Date {
  const thisMonth = clampedDay(now.getFullYear(), now.getMonth(), startDay);
  if (now >= thisMonth) return thisMonth;
  return clampedDay(now.getFullYear(), now.getMonth() - 1, startDay);
}

/**
 * Small note for the monthly card. If the router's counters were cleared after the
 * billing month began (e.g. new router, manual reset), "this month" really means
 * "since that day", so say so instead of implying a full month.
 */
export function usageNote(startDay: number, lastCleared: Date | null, now: Date): string {
  if (lastCleared && lastCleared > periodStart(startDay, now)) return `Since ${shortDate(lastCleared)}`;
  return `Resets on the ${ordinal(startDay)}`;
}

/** DESIGN.md §7 progress bar: < 80 % normal, 80–100 % warning, > 100 % danger. */
export function usageTone(fraction: number): Tone {
  if (fraction > 1) return 'danger';
  if (fraction >= 0.8) return 'warning';
  return 'primary';
}
