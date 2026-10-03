import { RELOCK_AFTER_MS, shouldRelock } from '../appLock';

describe('app lock: when to lock again', () => {
  const NOW = 1_000_000;

  it('does not lock when the app never left', () => {
    expect(shouldRelock(null, NOW)).toBe(false);
  });

  it('does not lock after a short trip away', () => {
    expect(shouldRelock(NOW - 5_000, NOW)).toBe(false);
    expect(shouldRelock(NOW - RELOCK_AFTER_MS, NOW)).toBe(false);
  });

  it('locks after more than a minute away', () => {
    expect(shouldRelock(NOW - RELOCK_AFTER_MS - 1, NOW)).toBe(true);
    expect(shouldRelock(NOW - 10 * 60_000, NOW)).toBe(true);
  });
});
