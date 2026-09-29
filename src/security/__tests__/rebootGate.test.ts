import { clearRebootRequested, isRebootRequested, markRebootRequested } from '@/state/rebootGate';

// The Rebooting screen ends the session; a deep link alone must not open it (AGENTS.md §8.4).
describe('rebootGate', () => {
  beforeEach(clearRebootRequested);

  it('is closed unless a reboot was just confirmed in the app', () => {
    expect(isRebootRequested(1_000)).toBe(false);
  });

  it('opens right after a confirmed reboot and closes after a minute', () => {
    markRebootRequested(10_000);
    expect(isRebootRequested(15_000)).toBe(true);
    expect(isRebootRequested(70_001)).toBe(false);
  });

  it('closes when the user is done', () => {
    markRebootRequested(10_000);
    clearRebootRequested();
    expect(isRebootRequested(11_000)).toBe(false);
  });
});
