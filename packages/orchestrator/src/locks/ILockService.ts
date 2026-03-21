export interface ILockService {
  acquire(key: string, ttlMs: number): Promise<void>;
  release(key: string): Promise<void>;
  // Unconditional delete — used by RecoveryEngine to clear stale locks
  // left behind by crashed processes. Never call this on a live execution.
  forceRelease(key: string): Promise<void>;
}
