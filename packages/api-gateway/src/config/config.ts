import { z } from 'zod';
import { createLogger } from '@chronos/shared';

const ConfigSchema = z.object({
  port: z.coerce.number().default(3000),
  jwtSecret: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  orchestratorUrl: z.string().url(),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  rateLimitWindowMs: z.coerce.number().default(60_000),
  rateLimitMax: z.coerce.number().default(100),
});

export type GatewayConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(): GatewayConfig {
  const result = ConfigSchema.safeParse({
    port: process.env.GATEWAY_PORT,
    jwtSecret: process.env.JWT_SECRET,
    orchestratorUrl: process.env.ORCHESTRATOR_URL,
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: process.env.RATE_LIMIT_MAX,
  });

  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');

    // In test env — throw so Jest catches it cleanly instead of killing the worker
    if (process.env.NODE_ENV === 'test') {
      throw new Error(`Invalid config: ${message}`);
    }

    const logger = createLogger('api-gateway');
    logger.error('Invalid configuration — service will not start', { message });
    process.exit(1);
  }

  return result.data;
}
