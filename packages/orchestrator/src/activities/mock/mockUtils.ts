/**
 * Determines whether a mock activity step should simulate a failure.
 *
 * Three env vars control this:
 *  - MOCK_FAIL_STEPS    — comma-separated list of step names that ALWAYS fail
 *                         e.g. "update-inventory,send-confirmation"
 *  - MOCK_FAIL_ATTEMPTS — comma-separated "step:N" pairs; the named step fails
 *                         on its first N calls then succeeds
 *                         e.g. "charge-card:1" → fails once, succeeds on retry
 *  - MOCK_FAILURE_RATE  — 0.0–1.0 probability applied to every other step
 *                         e.g. "0.9" means 90% random failure chance
 *
 * MOCK_FAIL_STEPS takes precedence — useful for deterministic tests where you
 * need a specific step to fail every time (e.g. to verify compensation).
 */

// Per-step call counter used by MOCK_FAIL_ATTEMPTS
const stepCallCounts = new Map<string, number>();

export function resetStepCallCounts(): void {
  stepCallCounts.clear();
}

export function shouldFail(stepName: string): boolean {
  const callCount = (stepCallCounts.get(stepName) ?? 0) + 1;
  stepCallCounts.set(stepName, callCount);

  const failSteps = process.env.MOCK_FAIL_STEPS ?? '';
  if (failSteps) {
    const names = failSteps.split(',').map(s => s.trim());
    if (names.includes(stepName)) return true;
  }

  // MOCK_FAIL_ATTEMPTS=charge-card:1 → fail charge-card on the first 1 call only
  const failAttempts = process.env.MOCK_FAIL_ATTEMPTS ?? '';
  if (failAttempts) {
    for (const entry of failAttempts.split(',').map(s => s.trim())) {
      const [name, n] = entry.split(':');
      if (name === stepName && callCount <= parseInt(n, 10)) return true;
    }
  }

  const rate = parseFloat(process.env.MOCK_FAILURE_RATE ?? '0');
  return Math.random() < rate;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
