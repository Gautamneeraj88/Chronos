import 'dotenv/config';
import express from 'express';
import { RabbitMQClient } from '@chronos/rabbitmq';
import { createLogger } from '@chronos/shared';
import { NotificationConsumer } from './NotificationConsumer';
import { auditLogHandler, webhookHandler } from './handlers';

const logger = createLogger('notifier');
const PORT = Number(process.env.PORT ?? 3003);

async function main() {
  // Connect to RabbitMQ
  const rabbitClient = RabbitMQClient.getInstance();
  await rabbitClient.connect();
  logger.info('RabbitMQ connected');

  // Start the consumer — bind to all execution events for all orgs
  const consumer = new NotificationConsumer(
    rabbitClient,
    'chronos.notifier.queue',
    'execution.#',
    [auditLogHandler, webhookHandler],
  );
  await consumer.start();

  // Minimal health endpoint
  const app = express();
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notifier' }));
  app.listen(PORT, () => logger.info(`Notifier listening on :${PORT}`));
}

main().catch((err) => {
  console.error('Notifier failed to start', err);
  process.exit(1);
});
