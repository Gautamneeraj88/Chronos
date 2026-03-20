import express, { Express } from 'express';
import { GatewayConfig } from './config/config';
import { requestIdMiddleware, rateLimitMiddleware, errorHandler } from './middleware';
import { healthRouter, workflowRouter, executionRouter } from './routes';
import { IOrchestratorClient } from './http';

// Dependencies the app needs injected (so tests can pass mocks)
export interface AppDependencies {
  orchestratorClient: IOrchestratorClient;
}

export function createApp(config: GatewayConfig, deps: AppDependencies): Express {
  const app = express();

  // Parse JSON bodies
  app.use(express.json());

  // Attach a unique request ID to every request
  app.use(requestIdMiddleware);

  // Rate limiting - before auth so bots get blocked cheaply
  app.use(rateLimitMiddleware(config));

  // Routes - health has no auth, others do (auth applied inside each router)
  app.use('/health', healthRouter());
  app.use('/workflows', workflowRouter(deps.orchestratorClient));
  app.use('/executions', executionRouter(deps.orchestratorClient));

  // Error handler MUST be last - Express identifies it by the 4 arguments
  app.use(errorHandler);

  return app;
}
