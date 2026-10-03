// App lock timing (AGENTS.md §8.8), kept apart from the provider so it can be tested
// without loading UI code.
export const RELOCK_AFTER_MS = 60 * 1000;

/** Whether the app must lock again after being away. */
export function shouldRelock(backgroundedAt: number | null, now: number): boolean {
  return backgroundedAt !== null && now - backgroundedAt > RELOCK_AFTER_MS;
}
