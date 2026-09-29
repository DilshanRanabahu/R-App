import { ordinal, periodStart, shortDate, usageNote, usageTone } from '../usage';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('ordinal', () => {
  it('uses the right suffix', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st',
    ]);
  });
});

describe('shortDate', () => {
  it('formats day and month', () => {
    expect(shortDate(day(2026, 9, 26))).toBe('26 Sep');
  });
});

describe('periodStart', () => {
  it('is this month once the start day has passed', () => {
    expect(periodStart(1, day(2026, 9, 29))).toEqual(day(2026, 9, 1));
    expect(periodStart(15, day(2026, 9, 15))).toEqual(day(2026, 9, 15));
  });

  it('is last month before the start day', () => {
    expect(periodStart(15, day(2026, 9, 10))).toEqual(day(2026, 8, 15));
    expect(periodStart(20, day(2026, 1, 5))).toEqual(day(2025, 12, 20));
  });

  it('clamps day 31 to short months', () => {
    expect(periodStart(31, day(2026, 9, 30))).toEqual(day(2026, 9, 30));
  });
});

describe('usageNote', () => {
  const now = day(2026, 9, 29);

  it('says when the counters were cleared mid-month', () => {
    expect(usageNote(1, day(2026, 9, 26), now)).toBe('Since 26 Sep');
  });

  it('otherwise shows the reset day', () => {
    expect(usageNote(1, day(2026, 9, 1), now)).toBe('Resets on the 1st');
    expect(usageNote(1, day(2026, 8, 3), now)).toBe('Resets on the 1st');
    expect(usageNote(22, null, now)).toBe('Resets on the 22nd');
  });
});

describe('usageTone', () => {
  it('warns from 80 % and flags going over the plan', () => {
    expect(usageTone(0.5)).toBe('primary');
    expect(usageTone(0.8)).toBe('warning');
    expect(usageTone(1)).toBe('warning');
    expect(usageTone(1.05)).toBe('danger');
  });
});
