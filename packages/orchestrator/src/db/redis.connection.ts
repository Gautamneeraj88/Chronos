import Redis from 'ioredis';
import { createLogger } from '@chronos/shared';

const logger = createLogger('orchestrator');

export function connectRedis(url: string): Redis {
  /* NOTE:
   * ioredis connects lazily - no await needed
   * it reconnects automactically on failure
   */
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    enableOfflineQueue: false, // fail fast rather than queue indefinitely when Redis is down
    connectTimeout: 5_000,
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err) => logger.error('Redis error', { error: err.message }));
  client.on('reconnecting', () => logger.warn('Redis reconnecting'));

  return client;
}
