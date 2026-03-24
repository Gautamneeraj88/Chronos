import './tracing'; // must be first — instruments libraries before they load
process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';
import 'dotenv/config';
import express from 'express';
import { loadConfig } from './config/config';
import { KafkaClient } from '@chronos/kafka';
import { Worker } from './worker';
import { createLogger } from '@chronos/shared';
import { register } from './metrics/metrics';

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

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
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
