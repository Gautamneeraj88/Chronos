import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { GatewayConfig } from './config/config';
import { requestIdMiddleware, rateLimitMiddleware, errorHandler } from './middleware';
import { healthRouter, workflowRouter, executionRouter, authRouter, apiKeyRouter, webhookRouter } from './routes';
import { IOrchestratorClient } from './http';
import { createYogaMiddleware } from './graphql';
import { register, httpRequestsTotal, httpRequestDuration } from './metrics';
import { openapiSpec, swaggerUiMiddleware } from './openapi';

// Dependencies the app needs injected (so tests can pass mocks)
export interface AppDependencies {
  orchestratorClient: IOrchestratorClient;
}

export function createApp(config: GatewayConfig, deps: AppDependencies): Express {
  const app = express();

  // CORS — allow dashboard origin
  app.use(cors({
    origin: process.env.DASHBOARD_URL ?? 'http://localhost:5173',
    credentials: true,
  }));

  // Parse JSON bodies
  app.use(express.json());

  // Prometheus metrics — no auth required, scraped by Prometheus
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  // Request instrumentation — track rate and latency per route
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const route = req.path;
    res.on('finish', () => {
      const duration = Date.now() - start;
      httpRequestsTotal.inc({ method: req.method, route, status: String(res.statusCode) });
      httpRequestDuration.observe({ method: req.method, route }, duration);
    });
    next();
  });

  // Attach a unique request ID to every request
  app.use(requestIdMiddleware);

  // Rate limiting - before auth so bots get blocked cheaply
  app.use(rateLimitMiddleware(config));

  // OpenAPI docs — raw JSON first (must precede swagger-ui which captures all /docs/* paths)
  // Swagger UI at /docs, raw spec at /openapi.json
  // In production you may want to guard this behind auth or disable it entirely.
  app.get('/openapi.json', (_req, res) => res.json(openapiSpec));
  app.use('/docs', swaggerUiMiddleware);

  // Auth routes — login is public, others use auth middleware internally
  app.use('/auth', authRouter(deps.orchestratorClient));

  // Routes - health has no auth, others do (auth applied inside each router)
  app.use('/health', healthRouter());
  app.use('/workflows', workflowRouter(deps.orchestratorClient));
  app.use('/executions', executionRouter(deps.orchestratorClient));
  app.use('/api-keys', apiKeyRouter(deps.orchestratorClient));
  app.use('/webhooks', webhookRouter(deps.orchestratorClient));

  // GraphQL endpoint — yoga handles its own auth via context builder
  const yoga = createYogaMiddleware(deps.orchestratorClient);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use('/graphql', yoga as any);

  // Error handler MUST be last - Express identifies it by the 4 arguments
  app.use(errorHandler);

  return app;
}
