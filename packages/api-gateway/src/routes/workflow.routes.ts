import { Router, Request, Response, NextFunction } from 'express';
import { IOrchestratorClient } from '../http';
import { authMiddleware } from '../middleware';
import { CreateWorkflowSchema, TriggerExecutionSchema, ValidationError } from '@chronos/shared';

export function workflowRouter(orchestrator: IOrchestratorClient): Router {
  const router = Router();
  const protect = authMiddleware(orchestrator);

  // POST /workflows - register a new workflow definition
  router.post('/', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = CreateWorkflowSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0].message);
      }

      // orgId is sent via X-Org-Id header by the client implementation; inject here for type safety
      const workflow = await orchestrator.createWorkflow(
        { ...parsed.data, orgId: req.orgId! },
        req.orgId!,
      );
      res.status(201).json(workflow);
    } catch (err) {
      next(err);
    }
  });

  // GET /workflows - list all definitions
  router.get('/', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflows = await orchestrator.listWorkflows(req.orgId!);
      res.status(200).json(workflows);
    } catch (err) {
      next(err);
    }
  });

  // GET /workflows/:id - get one definition
  router.get('/:id', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflow = await orchestrator.getWorkflow(req.params.id, req.orgId!);
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
        req.orgId!,
      );
      res.status(201).json(execution);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
