import 'dotenv/config';
import { loadConfig } from './config/config';
import { createApp } from './app';
import { OrchestratorClient } from './http/OrchestratorClient';
import { createLogger } from '@chronos/shared';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger('api-gateway');

  const orchestratorClient = new OrchestratorClient(config.orchestratorUrl);

  const app = createApp(config, { orchestratorClient });

  app.listen(config.port, () => {
    logger.info(`API Gateway running`, { port: config.port, env: config.nodeEnv });
  });
}

bootstrap().catch((err) => {
  console.error('Gateway failed to start', err);
  process.exit(1);
});
