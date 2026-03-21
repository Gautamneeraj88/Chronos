import { Router, Request, Response, NextFunction } from 'express';
import { WorkflowService }   from '../services/WorkflowService';
import { ExecutionService }  from '../services/ExecutionService';
import { CreateWorkflowSchema, TriggerExecutionSchema, ValidationError } from '@chronos/shared';

export function internalRouter(
  workflowService: WorkflowService,
  executionService: ExecutionService
): Router {
  const router = Router();

  // ── Workflow endpoints ─────────────────────────────────────────────────

  router.post('/workflows', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = CreateWorkflowSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0].message);
      }
      const workflow = await workflowService.register(parsed.data);
      res.status(201).json(workflow);
    } catch (err) {
      next(err);
    }
  });

  router.get('/workflows', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const workflows = await workflowService.listAll();
      res.status(200).json(workflows);
    } catch (err) {
      next(err);
    }
  });

  router.get('/workflows/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflow = await workflowService.getById(req.params.id);
      res.status(200).json(workflow);
    } catch (err) {
      next(err);
    }
  });

  // ── Execution endpoints ────────────────────────────────────────────────

  router.post('/executions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId, input, userId } = req.body;
      if (!workflowId) throw new ValidationError('workflowId is required');

      const parsed = TriggerExecutionSchema.safeParse({ input: input ?? {} });
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0].message);
      }

      const execution = await executionService.triggerExecution(
        workflowId,
        parsed.data.input,
        userId ?? 'system'
      );
      res.status(201).json(execution);
    } catch (err) {
      next(err);
    }
  });

  router.get('/executions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const execution = await executionService.getExecution(req.params.id);
      res.status(200).json(execution);
    } catch (err) {
      next(err);
    }
  });

  router.get('/executions/:id/events', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await executionService.getExecutionEvents(req.params.id);
      res.status(200).json(events);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
