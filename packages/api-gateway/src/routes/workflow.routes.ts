import { Router, Request, Response, NextFunction } from 'express';
import { IOrchestratorClient } from '../http';
import { authMiddleware } from '../middleware';
import { CreateWorkflowSchema, TriggerExecutionSchema, ValidationError } from '@chronos/shared';
import { loadConfig } from '../config/config';

export function workflowRouter(orchestrator: IOrchestratorClient): Router {
  const router = Router();
  const config = loadConfig();
  const protect = authMiddleware(config.jwtSecret);

  // POST /workflows - register a new workflows definition
  router.post('/', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validdate the request body with Zod
      const parsed = CreateWorkflowSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0].message);
      }

      const workflow = await orchestrator.createWorkflow(parsed.data);
      res.status(201).json(workflow);
    } catch (err) {
      next(err); // always delegate to errorHandler
    }
  });

  // GET /workflows - list all definitions
  router.get('/', protect, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const workflows = await orchestrator.listWorkflows();
      res.status(200).json(workflows);
    } catch (err) {
      next(err);
    }
  });

  // GET /workflows/:id - get one definition
  router.get('/:id', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflow = await orchestrator.getWorkflow(req.params.id);
      res.status(200).json(workflow);
    } catch (err) {
      next(err);
    }
  });

  // POST /workflows/:id/executions - trigger an execution
  router.post('/:id/executions', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = TriggerExecutionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0].message);
      }

      const execution = await orchestrator.triggerExecution(
        req.params.id,
        parsed.data.input,
        req.user!.userId,
      );
      res.status(201).json(execution);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
