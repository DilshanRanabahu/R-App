import {
  appendSample,
  areaPath,
  axisScale,
  monotonePath,
  niceMax,
  summarize,
  toPoints,
  type SpeedSample,
} from '../chart';

const sample = (t: number, down = 0, up = 0): SpeedSample => ({ t, down, up });

describe('appendSample', () => {
  it('adds samples and drops ones older than the window', () => {
    let s: SpeedSample[] = [];
    s = appendSample(s, sample(0), 60_000);
    s = appendSample(s, sample(30_000), 60_000);
    s = appendSample(s, sample(61_000), 60_000);
    expect(s.map((x) => x.t)).toEqual([30_000, 61_000]);
  });

  it('ignores repeated or older timestamps', () => {
    const s = [sample(1000)];
    expect(appendSample(s, sample(1000))).toBe(s);
    expect(appendSample(s, sample(500))).toBe(s);
  });
});

describe('niceMax', () => {
  it('rounds up to 1 / 2 / 5 steps', () => {
    expect(niceMax(1_300_000)).toBe(2_000_000);
    expect(niceMax(4_100_000)).toBe(5_000_000);
    expect(niceMax(6_000_000)).toBe(10_000_000);
    expect(niceMax(2_000_000)).toBe(2_000_000);
  });

  it('never goes below the floor, so idle noise stays flat', () => {
    expect(niceMax(0)).toBe(100_000);
    expect(niceMax(40_000)).toBe(100_000);
  });
});

describe('summarize', () => {
  it('gives top and average per direction', () => {
    expect(summarize([sample(0, 100, 10), sample(3000, 300, 30)])).toEqual({
      topDown: 300,
      topUp: 30,
      avgDown: 200,
      avgUp: 20,
    });
  });

  it('is empty before the first sample', () => {
    expect(summarize([])).toEqual({ topDown: null, topUp: null, avgDown: null, avgUp: null });
  });
});

describe('axisScale', () => {
  it('uses Mbps from 1 Mbps up, with a half-way tick', () => {
    expect(axisScale(5_000_000)).toEqual({ unit: 'Mbps', ticks: ['5', '2.5', '0'] });
    expect(axisScale(1_000_000)).toEqual({ unit: 'Mbps', ticks: ['1', '0.5', '0'] });
    expect(axisScale(20_000_000)).toEqual({ unit: 'Mbps', ticks: ['20', '10', '0'] });
  });

  it('uses kbps below 1 Mbps', () => {
    expect(axisScale(100_000)).toEqual({ unit: 'kbps', ticks: ['100', '50', '0'] });
    expect(axisScale(500_000)).toEqual({ unit: 'kbps', ticks: ['500', '250', '0'] });
  });
});

describe('monotonePath', () => {
  it('handles empty and single points', () => {
    expect(monotonePath([])).toBe('');
    expect(monotonePath([{ x: 1, y: 2 }])).toBe('M1,2');
  });

  it('never overshoots between points', () => {
    const pts = [
      { x: 0, y: 50 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 50 },
    ];
    const ys = monotonePath(pts)
      .split(/[MC]/)
      .filter(Boolean)
      .flatMap((seg) => seg.split(',').map(Number).filter((_, i) => i % 2 === 1));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(50);
  });
});

describe('areaPath', () => {
  it('closes the line down to the baseline', () => {
    const d = areaPath(
      [
        { x: 0, y: 10 },
        { x: 20, y: 5 },
      ],
      40,
    );
    expect(d.endsWith('L20,40L0,40Z')).toBe(true);
  });

  it('needs at least two points', () => {
    expect(areaPath([{ x: 0, y: 0 }], 40)).toBe('');
  });
});

describe('toPoints', () => {
  it('puts the newest sample at the right edge and scales to height', () => {
    const pts = toPoints([sample(0, 0), sample(30_000, 500), sample(60_000, 1000)], 'down', 300, 100, 1000);
    expect(pts).toEqual([
      { x: 0, y: 100 },
      { x: 150, y: 50 },
      { x: 300, y: 0 },
    ]);
  });

  it('clips values above the scale', () => {
    const [p] = toPoints([sample(0, 5000)], 'down', 300, 100, 1000);
    expect(p?.y).toBe(0);
  });
});
