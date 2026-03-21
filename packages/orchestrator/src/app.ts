import express, { Express } from 'express';
import { WorkflowService, ExecutionService } from './services';
import { internalRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';

export interface OrchestratorDeps {
  workflowService: WorkflowService;
  executionService: ExecutionService;
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

  //All routes prefixed with /internal - not exposed publicly
  app.use('/internal', internalRouter(deps.workflowService, deps.executionService));

  app.use(errorHandler);
  return app;
}
