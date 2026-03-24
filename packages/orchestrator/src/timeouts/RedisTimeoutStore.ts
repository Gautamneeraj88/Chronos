import Redis from 'ioredis';
import { ITimeoutStore } from './ITimeoutStore';

const SET_KEY = 'chronos:pending-timeouts';

export class RedisTimeoutStore implements ITimeoutStore {
  constructor(private readonly redis: Redis) {}

  async schedule(executionId: string, stepId: string, expiresAt: number): Promise<void> {
    await this.redis.zadd(SET_KEY, expiresAt, `${executionId}:${stepId}`);
  }

  async cancel(executionId: string, stepId: string): Promise<void> {
    await this.redis.zrem(SET_KEY, `${executionId}:${stepId}`);
  }

  async consumeExpired(): Promise<Array<{ executionId: string; stepId: string }>> {
    const now = Date.now();
    // Pipeline: fetch then remove in a single round-trip.
    // Not a MULTI/EXEC transaction, but safe with a single TimeoutChecker instance.
    const pipeline = this.redis.pipeline();
    pipeline.zrangebyscore(SET_KEY, 0, now);
    pipeline.zremrangebyscore(SET_KEY, 0, now);
    const results = await pipeline.exec();

    const members = (results?.[0]?.[1] as string[]) ?? [];
    return members.map((m) => {
      const colonIdx = m.indexOf(':');
      return {
        executionId: m.slice(0, colonIdx),
        stepId: m.slice(colonIdx + 1),
      };
    });
  }
}
