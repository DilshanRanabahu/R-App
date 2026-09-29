import { getDataPlan, getMonthUsage } from '../endpoints/monitoring';
import { toByteLimit, toLocalDate } from '../endpoints/parse';

// Made-up usage numbers (AGENTS.md §9).
const mockGet = jest.fn();
jest.mock('../client', () => ({ routerClient: { get: (path: string) => mockGet(path) } }));

describe('toByteLimit', () => {
  it('parses router plan sizes with 1024 steps', () => {
    expect(toByteLimit('60GB')).toBe(60 * 1024 ** 3);
    expect(toByteLimit('500MB')).toBe(500 * 1024 ** 2);
    expect(toByteLimit('1.5gb')).toBe(1.5 * 1024 ** 3);
  });

  it('returns 0 for empty or unknown values', () => {
    expect(toByteLimit('0MB')).toBe(0);
    expect(toByteLimit('')).toBe(0);
    expect(toByteLimit(undefined)).toBe(0);
    expect(toByteLimit('lots')).toBe(0);
  });
});

describe('toLocalDate', () => {
  it('parses YYYY-MM-DD as a local date', () => {
    expect(toLocalDate('2026-09-26')).toEqual(new Date(2026, 8, 26));
  });

  it('rejects anything else', () => {
    expect(toLocalDate('26/09/2026')).toBeNull();
    expect(toLocalDate(undefined)).toBeNull();
  });
});

describe('getMonthUsage', () => {
  it('maps month_statistics', async () => {
    mockGet.mockResolvedValueOnce({
      CurrentMonthDownload: '3000',
      CurrentMonthUpload: '1000',
      CurrentDayUsed: '500',
      MonthLastClearTime: '2026-09-01',
    });
    expect(await getMonthUsage()).toEqual({
      download: 3000,
      upload: 1000,
      today: 500,
      lastCleared: new Date(2026, 8, 1),
    });
    expect(mockGet).toHaveBeenCalledWith('/api/monitoring/month_statistics');
  });
});

describe('getDataPlan', () => {
  it('reads an enabled plan', async () => {
    mockGet.mockResolvedValueOnce({ StartDay: '15', DataLimit: '60GB', SetMonthData: '1' });
    expect(await getDataPlan()).toEqual({ startDay: 15, limitBytes: 60 * 1024 ** 3 });
  });

  it('treats a disabled or zero plan as no plan', async () => {
    mockGet.mockResolvedValueOnce({ StartDay: '1', DataLimit: '60GB', SetMonthData: '0' });
    expect((await getDataPlan()).limitBytes).toBeNull();
    mockGet.mockResolvedValueOnce({ StartDay: '1', DataLimit: '0MB', SetMonthData: '1' });
    expect((await getDataPlan()).limitBytes).toBeNull();
  });

  it('falls back to day 1 for a bad start day', async () => {
    mockGet.mockResolvedValueOnce({ StartDay: '0', DataLimit: '0MB', SetMonthData: '0' });
    expect((await getDataPlan()).startDay).toBe(1);
  });
});
