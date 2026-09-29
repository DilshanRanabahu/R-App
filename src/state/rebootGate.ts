// The Rebooting screen ends the local session, so it must only run right after the user
// really confirmed a reboot in the app, never from a deep link (AGENTS.md §8.4).
const VALID_MS = 60_000;
let requestedAt = 0;

/** Call when the router accepted a reboot the user confirmed. */
export function markRebootRequested(now = Date.now()): void {
  requestedAt = now;
}

/** True only shortly after markRebootRequested(). */
export function isRebootRequested(now = Date.now()): boolean {
  return requestedAt > 0 && now - requestedAt < VALID_MS;
}

export function clearRebootRequested(): void {
  requestedAt = 0;
}
