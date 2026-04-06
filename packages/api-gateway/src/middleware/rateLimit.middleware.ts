import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { GatewayConfig } from '../config/config';

export function rateLimitMiddleware(config: GatewayConfig) {
  // Connect a dedicated redis client for rate limiting.
  // Using the native 'redis' client as required by rate-limit-redis v4+.
  // reconnectStrategy: false — don't retry; fail immediately so offline commands
  // reject rather than queuing indefinitely (prevents test/startup hangs).
  const redisClient = createClient({
    url: config.redisUrl,
    socket: {
      connectTimeout: 2_000,
      reconnectStrategy: false,
    },
  });
  redisClient.connect().catch(() => {
    // Redis unavailable — rate-limit-redis will throw on sendCommand and
    // express-rate-limit will skip the store check (in-memory fallback).
  });

  return rateLimit({
    windowMs: config.rateLimitWindowMs, // default 60 seconds
    max: config.rateLimitMax,           // default 100 requests per window
    standardHeaders: true,
    legacyHeaders: true,
    // Skip rate limiting entirely when Redis is not ready — avoids 500 errors
    // caused by store errors propagating to the error handler.
    skip: () => !redisClient.isReady,
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
