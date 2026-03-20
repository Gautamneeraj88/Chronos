import rateLimit from 'express-rate-limit';
import { GatewayConfig } from '../config/config';

export function rateLimitMiddleware(config: GatewayConfig) {
  return rateLimit({
    windowMs: config.rateLimitWindowMs, // default 60 seconds
    max: config.rateLimitMax, // default 100 request per window
    standardHeaders: true,
    legacyHeaders: true,
    // Custom message matching our error format
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many request, please try again later',
      },
    },
  });
}
