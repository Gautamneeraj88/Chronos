import 'dotenv/config';
import express from 'express';
import { RabbitMQClient } from '@chronos/rabbitmq';
import { createLogger } from '@chronos/shared';
import { NotificationConsumer } from './NotificationConsumer';
import { auditLogHandler, webhookHandler } from './handlers';
import { addSseClient, removeSseClient } from './sse';

const logger = createLogger('notifier');
const PORT = Number(process.env.PORT ?? 3003);
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'http://localhost:5173';

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

  // HTTP server — health + SSE
  const app = express();

  // CORS — allow the dashboard to connect via EventSource
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', DASHBOARD_URL);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notifier' }));

  /** SSE endpoint — dashboard EventSource connects here for live notifications */
  app.get('/sse', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Keep the connection alive with a comment every 30 s
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 30_000);

    addSseClient(res);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeSseClient(res);
    });
  });

  app.listen(PORT, () => logger.info(`Notifier listening on :${PORT}`));
}

main().catch((err) => {
  console.error('Notifier failed to start', err);
  process.exit(1);
});
