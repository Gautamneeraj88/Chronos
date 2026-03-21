import 'dotenv/config';
import { loadConfig } from './config/config';
import { connectMongoDB, connectRedis } from './db';
import { createLogger } from '@chronos/shared';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger('orchestrator');

  await connectMongoDB(config.mongoUri);
  connectRedis(config.redisUri);

  logger.info('Orchestrator ready', { port: config.port });
  // TODO: app.listen() come in week 5 after services are wired
}

bootstrap().catch((err) => {
  console.error('Orchestrator failed to start', err);
  process.exit(1);
});
