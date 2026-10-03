import { EMPTY_TRACK, HISTORY_LENGTH, addReading, belowBest, rsrpFraction, trend } from '../antenna';
import { formatClock } from '../format';

describe('antenna tracking', () => {
  it('remembers the strongest reading and ignores missing ones', () => {
    let track = EMPTY_TRACK;
    for (const value of [-105, -98, null, -101]) track = addReading(track, value);
    expect(track.best).toBe(-98);
    expect(track.history).toEqual([-105, -98, -101]);
  });

  it('keeps only the latest readings', () => {
    let track = EMPTY_TRACK;
    for (let i = 0; i < HISTORY_LENGTH + 5; i++) track = addReading(track, -120 + i);
    expect(track.history).toHaveLength(HISTORY_LENGTH);
    expect(track.history.at(-1)).toBe(-120 + HISTORY_LENGTH + 4);
    // The best stays even after it scrolled out of the history.
    expect(track.best).toBe(-120 + HISTORY_LENGTH + 4);
  });

  it('says how far below the best the current reading is', () => {
    expect(belowBest(-98, -98)).toBe(0);
    expect(belowBest(-103, -98)).toBe(5);
    expect(belowBest(null, -98)).toBeNull();
    expect(belowBest(-98, null)).toBeNull();
  });

  it('maps RSRP to a 0–1 bar height', () => {
    expect(rsrpFraction(-120)).toBe(0);
    expect(rsrpFraction(-95)).toBe(0.5);
    expect(rsrpFraction(-70)).toBe(1);
    expect(rsrpFraction(-60)).toBe(1);
    expect(rsrpFraction(-140)).toBe(0);
  });

  it('reports the trend from the last six readings, ignoring 1 dB of noise', () => {
    expect(trend([-100, -100])).toBe('steady');
    expect(trend([-105, -105, -105, -100, -99, -98])).toBe('better');
    expect(trend([-95, -95, -95, -100, -101, -102])).toBe('worse');
    expect(trend([-100, -101, -100, -100, -101, -100])).toBe('steady');
  });
});

describe('formatClock', () => {
  it('turns minutes after midnight into a 24-hour time', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(60)).toBe('01:00');
    expect(formatClock(300)).toBe('05:00');
    expect(formatClock(23 * 60 + 59)).toBe('23:59');
    expect(formatClock(1440)).toBe('00:00');
  });
});
