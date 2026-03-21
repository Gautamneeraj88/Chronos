import { z } from 'zod';

const ConfigSchema = z.object({
  port: z.coerce.number().default(3001),
  mongoUri: z.string().min(1),
  redisUri: z.string().min(1),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z..enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type OrchestratorConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(): OrchestratorConfig {
  const result = ConfigSchema.safeParse({
    port:     process.env.ORCHESTRATOR_PORT,
    mongoUri: process.env.MONGODB_URI,
    redisUrl: process.env.REDIS_URL,
    nodeEnv:  process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
  });

   if (!result.success) {
    const message = result.error.issues.map(i => i.message).join(', ');
    if (process.env.NODE_ENV === 'test') throw new Error(`Invalid config: ${message}`);
    console.error('Invalid orchestrator config:', message);
    process.exit(1);
  }

  return result.data;
}
