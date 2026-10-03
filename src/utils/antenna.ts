// Antenna positioning mode: remember the best signal seen while the owner moves the router.

export const HISTORY_LENGTH = 30;

export interface AntennaTrack {
  /** Strongest RSRP seen (dBm), null before the first reading. */
  best: number | null;
  /** Last readings, oldest first. */
  history: number[];
}

export const EMPTY_TRACK: AntennaTrack = { best: null, history: [] };

export function addReading(track: AntennaTrack, rsrp: number | null): AntennaTrack {
  if (rsrp === null) return track;
  return {
    best: track.best === null ? rsrp : Math.max(track.best, rsrp),
    history: [...track.history, rsrp].slice(-HISTORY_LENGTH),
  };
}

/** 0–1 bar height for an RSRP value: −120 dBm (unusable) to −70 dBm (excellent). */
export function rsrpFraction(rsrp: number): number {
  return Math.min(1, Math.max(0, (rsrp + 120) / 50));
}

/** How far the current reading is below the best one, in dB (0 = at the best). */
export function belowBest(rsrp: number | null, best: number | null): number | null {
  if (rsrp === null || best === null) return null;
  return Math.max(0, Math.round(best - rsrp));
}

export type Trend = 'better' | 'worse' | 'steady';

/** Compares the last three readings with the three before them (1 dB of noise ignored). */
export function trend(history: number[]): Trend {
  if (history.length < 6) return 'steady';
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const change = mean(history.slice(-3)) - mean(history.slice(-6, -3));
  if (change > 1) return 'better';
  if (change < -1) return 'worse';
  return 'steady';
}
