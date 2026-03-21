import Redis from 'ioredis';
import { LockError } from '@chronos/shared';
import { ILockService } from './ILockService';

// Lua script for atomic lock release
// Why Lua? Because GET + DEL as two separate commands has a race condition:
//   Process A: GET → sees its own instanceId → ok
//   Process B: acquires lock (A crashed between GET and DEL)
//   Process A: DEL → deletes B's lock ← DISASTER
// Lua script runs atomically — no other command can run between the check and delete
const RELEASE_SCRIPT = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  else
    return 0
  end
`;

export class RedisLockService implements ILockService {
  // Track which locks THIS process holds and with what instanceId
  // instanceId = pid + timestamp — unique per process per lock acquisition
  private readonly heldLocks = new Map<string, string>();

  constructor(private readonly redis: Redis) {}

  async acquire(key: string, ttlMs: number): Promise<void> {
    const lockKey = `lock:${key}`;
    const instanceId = `${process.pid}-${Date.now()}`;

    // SET key value NX PX ttl
    // NX = only set if Not eXists
    // PX = expiry in milliseconds
    // Returns "OK" if set, null if key already exists
    const result = await this.redis.set(lockKey, instanceId, 'PX', ttlMs, 'NX');

    if (result !== 'OK') {
      throw new LockError(key);
    }

    this.heldLocks.set(key, instanceId);
  }

  async release(key: string): Promise<void> {
    const lockKey = `lock:${key}`;
    const instanceId = this.heldLocks.get(key);

    // If we don't have a record of holding this lock, nothing to do
    if (!instanceId) return;

    // Atomic check-and-delete via Lua
    await this.redis.eval(RELEASE_SCRIPT, 1, lockKey, instanceId);
    this.heldLocks.delete(key);
  }

  async forceRelease(key: string): Promise<void> {
    await this.redis.del(`lock:${key}`);
    this.heldLocks.delete(key);
  }
}
