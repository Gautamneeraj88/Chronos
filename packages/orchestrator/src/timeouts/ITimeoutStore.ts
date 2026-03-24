export interface ITimeoutStore {
  /** Register a pending step timeout. expiresAt is a Unix ms timestamp. */
  schedule(executionId: string, stepId: string, expiresAt: number): Promise<void>;

  /** Cancel a pending timeout when the step completes normally. */
  cancel(executionId: string, stepId: string): Promise<void>;

  /**
   * Atomically return and remove all entries whose expiresAt <= now.
   * Called by TimeoutChecker on every poll cycle.
   */
  consumeExpired(): Promise<Array<{ executionId: string; stepId: string }>>;
}
