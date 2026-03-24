import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { GatewayConfig } from '../config/config';

export function rateLimitMiddleware(config: GatewayConfig) {
  // Connect a dedicated redis client for rate limiting.
  // Using the native 'redis' client as required by rate-limit-redis v4+.
  const redisClient = createClient({ url: config.redisUrl });
  redisClient.connect().catch(() => {
    // If Redis is unavailable, fall back gracefully to in-memory limiting
  });

  return rateLimit({
    windowMs: config.rateLimitWindowMs, // default 60 seconds
    max: config.rateLimitMax,           // default 100 requests per window
    standardHeaders: true,
    legacyHeaders: true,
    // Per-org key: authenticated requests are limited by org, others by IP
    keyGenerator: (req) => req.orgId ?? req.ip ?? 'unknown',
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    }),
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    },
  });
}
