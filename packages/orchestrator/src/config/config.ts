import { z } from 'zod';

const ConfigSchema = z.object({
  port: z.coerce.number().default(3001),
  mongoUri: z.string().min(1),
  redisUri: z.string().min(1),
  kafkaBrokers: z.string().default('localhost:9092'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  neo4jUri:      z.string().default('bolt://localhost:7687'),
  neo4jUsername: z.string().default('neo4j'),
  neo4jPassword: z.string().default('chronos_dev'),
});

export type OrchestratorConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(): OrchestratorConfig {
  const result = ConfigSchema.safeParse({
    port:         process.env.ORCHESTRATOR_PORT,
    mongoUri:     process.env.MONGODB_URI,
    redisUri:     process.env.REDIS_URL,
    kafkaBrokers: process.env.KAFKA_BROKERS,
    nodeEnv:      process.env.NODE_ENV,
    logLevel:     process.env.LOG_LEVEL,
    neo4jUri:      process.env.NEO4J_URI,
    neo4jUsername: process.env.NEO4J_USERNAME,
    neo4jPassword: process.env.NEO4J_PASSWORD,
  });

   if (!result.success) {
    const message = result.error.issues.map(i => i.message).join(', ');
    if (process.env.NODE_ENV === 'test') throw new Error(`Invalid config: ${message}`);
    console.error('Invalid orchestrator config:', message);
    process.exit(1);
  }

  return result.data;
}
