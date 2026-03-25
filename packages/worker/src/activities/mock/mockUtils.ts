/**
 * Determines whether a mock activity step should simulate a failure.
 *
 * Three env vars control this (checked in priority order):
 *  - MOCK_FAIL_ATTEMPTS — comma-separated "step:maxAttempt" pairs.
 *                         e.g. "charge-card:1" fails charge-card on attempt 1 only
 *                         (succeeds from attempt 2 onward). Useful for retry tests.
 *  - MOCK_FAIL_STEPS    — comma-separated step names that ALWAYS fail every attempt.
 *                         e.g. "update-inventory,send-confirmation"
 *  - MOCK_FAILURE_RATE  — 0.0–1.0 probability applied to steps not matched above.
 *                         e.g. "0.9" means 90% random failure chance.
 */
export function shouldFail(stepName: string, attemptNumber = 1): boolean {
  // MOCK_FAIL_ATTEMPTS: "charge-card:1" → fail only on attempt 1
  const failAttempts = process.env.MOCK_FAIL_ATTEMPTS ?? '';
  if (failAttempts) {
    for (const entry of failAttempts.split(',').map(s => s.trim())) {
      const colonIdx = entry.lastIndexOf(':');
      if (colonIdx === -1) continue;
      const name = entry.slice(0, colonIdx).trim();
      const maxAttempt = parseInt(entry.slice(colonIdx + 1), 10);
      if (name === stepName && !isNaN(maxAttempt)) {
        return attemptNumber <= maxAttempt;
      }
    }
  }

  // MOCK_FAIL_STEPS: always fail regardless of attempt
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
