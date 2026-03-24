/**
 * Determines whether a mock activity step should simulate a failure.
 *
 * Two env vars control this:
 *  - MOCK_FAIL_STEPS  — comma-separated list of step names that ALWAYS fail
 *                       e.g. "update-inventory,send-confirmation"
 *  - MOCK_FAILURE_RATE — 0.0–1.0 probability applied to every step not in MOCK_FAIL_STEPS
 *                        e.g. "0.9" means 90% random failure chance
 *
 * MOCK_FAIL_STEPS takes precedence — useful for deterministic tests where you
 * need a specific step to fail every time (e.g. to verify compensation).
 */
export function shouldFail(stepName: string): boolean {
  const failSteps = process.env.MOCK_FAIL_STEPS ?? '';
  if (failSteps) {
    const names = failSteps.split(',').map(s => s.trim());
    if (names.includes(stepName)) return true;
  }

  const rate = parseFloat(process.env.MOCK_FAILURE_RATE ?? '0');
  return Math.random() < rate;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Delays for MOCK_STEP_DELAY_MS if set, otherwise falls back to defaultMs.
 * Used by activities so a single env var controls all step timing for testing.
 */
export function mockDelay(defaultMs: number): Promise<void> {
  const override = parseInt(process.env.MOCK_STEP_DELAY_MS ?? '', 10);
  return sleep(isNaN(override) ? defaultMs : override);
}
