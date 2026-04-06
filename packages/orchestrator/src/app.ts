import express, { Express } from 'express';
import mongoose from 'mongoose';
import type Redis from 'ioredis';
import type { KafkaClient } from '@chronos/kafka';
import { WorkflowService, ExecutionService, GraphQueryService, AuthService } from './services';
import { internalRouter, authRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { register } from './metrics/metrics';

export interface OrchestratorDeps {
  workflowService: WorkflowService;
  executionService: ExecutionService;
  graphQueryService?: GraphQueryService;
  authService: AuthService;
  redis?: Redis;
  kafkaClient?: KafkaClient;
}

export function createApp(deps: OrchestratorDeps): Express {
  const app = express();
  app.use(express.json());

  // Liveness — in-memory only, never fails unless the process is dead
  app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Readiness — checks MongoDB, Redis, and Kafka consumer group
  app.get('/health/ready', async (_req, res) => {
    const checks = await Promise.allSettled([
      mongoose.connection.db?.admin().ping() ?? Promise.reject(new Error('MongoDB not connected')),
      deps.redis?.ping() ?? Promise.reject(new Error('Redis not connected')),
      deps.kafkaClient?.ping() ?? Promise.reject(new Error('Kafka not configured')),
    ]);

    const [mongo, redisCheck, kafkaCheck] = checks;
    const healthy = checks.every((c) => c.status === 'fulfilled');

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ready' : 'degraded',
      mongodb: mongo.status,
      redis: redisCheck.status,
      kafka: kafkaCheck.status,
    });
  });

  // Keep bare /health as liveness alias for backwards-compat with existing healthchecks
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'orchestrator' });
  });

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  //All routes prefixed with /internal - not exposed publicly
  app.use('/internal', internalRouter(deps.workflowService, deps.executionService, deps.graphQueryService));
  app.use('/internal/auth', authRouter(deps.authService));

  app.use(errorHandler);
  return app;
}
