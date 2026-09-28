import { AttemptLimiter } from '../session';

jest.mock('@/api/auth', () => ({}));
jest.mock('@/api/endpoints/device', () => ({}));
jest.mock('../routerIdentity', () => ({}));

describe('AttemptLimiter', () => {
  it('allows 3 attempts per 5 minutes', () => {
    const limiter = new AttemptLimiter(3, 300_000);
    const t0 = 1_000_000;
    limiter.record(t0);
    limiter.record(t0 + 1000);
    expect(limiter.waitSeconds(t0 + 2000)).toBe(0);
    limiter.record(t0 + 2000);
    expect(limiter.waitSeconds(t0 + 3000)).toBe(297);
    expect(limiter.waitSeconds(t0 + 300_000)).toBe(0);
  });

  it('reset clears attempts', () => {
    const limiter = new AttemptLimiter(1, 60_000);
    limiter.record(0);
    expect(limiter.waitSeconds(1)).toBeGreaterThan(0);
    limiter.reset();
    expect(limiter.waitSeconds(1)).toBe(0);
  });
});
