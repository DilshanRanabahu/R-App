import { useState } from 'react';

import type { TrafficStats } from '@/api/types';
import { appendSample, type SpeedSample } from '@/utils/chart';

/**
 * Last 60 s of download/upload speed, built from the traffic polling (memory only).
 * `updatedAt` is react-query's dataUpdatedAt, so every poll adds a point even
 * when the numbers didn't change.
 */
export function useSpeedHistory(data: TrafficStats | undefined, updatedAt: number): SpeedSample[] {
  const [history, setHistory] = useState<{ at: number; samples: SpeedSample[] }>({
    at: 0,
    samples: [],
  });

  // Derived during render (React's "adjust state on prop change" pattern) rather
  // than in an effect, so the chart never lags one poll behind.
  if (data && updatedAt !== history.at) {
    setHistory({
      at: updatedAt,
      samples: appendSample(history.samples, {
        t: updatedAt,
        down: data.downloadRate * 8,
        up: data.uploadRate * 8,
      }),
    });
  }

  return history.samples;
}
