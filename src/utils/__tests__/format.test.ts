import { formatBytes, formatDuration, formatRate } from '../format';
import { overallRating, rateRsrp, rateSinr } from '../signal';

describe('format', () => {
  it('bytes use 1024 steps', () => {
    expect(formatBytes(0)).toEqual({ value: '0', unit: 'B' });
    expect(formatBytes(1536)).toEqual({ value: '1.5', unit: 'KB' });
    expect(formatBytes(185518901)).toEqual({ value: '177', unit: 'MB' });
    expect(formatBytes(50332081639)).toEqual({ value: '46.9', unit: 'GB' });
  });

  it('rates are bits per second', () => {
    expect(formatRate(494)).toEqual({ value: '4.0', unit: 'kbps' });
    expect(formatRate(1_550_000)).toEqual({ value: '12.4', unit: 'Mbps' });
  });

  it('durations', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(788)).toBe('13 min');
    expect(formatDuration(7800)).toBe('2 h 10 min');
    expect(formatDuration(273600)).toBe('3 d 4 h');
  });
});

describe('signal rating', () => {
  it('uses DESIGN.md thresholds', () => {
    expect(rateRsrp(-75)).toBe('excellent');
    expect(rateRsrp(-86)).toBe('good');
    expect(rateRsrp(-95)).toBe('fair');
    expect(rateRsrp(-110)).toBe('poor');
    expect(rateSinr(15)).toBe('good');
    expect(rateSinr(-2)).toBe('poor');
  });

  it('overall is the worse of RSRP and SINR', () => {
    expect(overallRating(-75, 5)).toBe('fair');
    expect(overallRating(-105, 25)).toBe('poor');
    expect(overallRating(null, 25)).toBe('excellent');
    expect(overallRating(null, null)).toBe('unknown');
  });
});
