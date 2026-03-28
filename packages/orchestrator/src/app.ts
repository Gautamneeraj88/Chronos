import express, { Express } from 'express';
import { WorkflowService, ExecutionService, GraphQueryService, AuthService } from './services';
import { internalRouter, authRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { register } from './metrics/metrics';

export interface OrchestratorDeps {
  workflowService: WorkflowService;
  executionService: ExecutionService;
  graphQueryService?: GraphQueryService;
  authService: AuthService;
}

export function createApp(deps: OrchestratorDeps): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'orchestrator',
    });
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
