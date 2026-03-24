import 'dotenv/config';
import express from 'express';
import { loadConfig } from './config/config';
import { KafkaClient } from '@chronos/kafka';
import { Worker } from './worker';
import { createLogger } from '@chronos/shared';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger('worker');

  //1. Connect to kafka
  const kafkaClient = KafkaClient.getInstance({
    clientId: config.workerId,
    brokers: config.kafkaBrokers,
  });

  //2. Start the worker consumer
  const worker = new Worker(kafkaClient, config.workerId);
  await worker.start();

  //3. health endpoint - useful for load balancers and monitoring
  const app = express();
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'worker',
      workerId: config.workerId,
    });
  });

  app.listen(config.port, () => {
    logger.info('Worker running', {
      port: config.port,
      workerId: config.workerId,
      env: config.nodeEnv,
    });
  });
}

bootstrap().catch((err) => {
  console.error('Worker failed to start', err);
  process.exit(1);
});
