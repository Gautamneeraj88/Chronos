import { Router, Request, Response, NextFunction } from 'express';
import { IOrchestratorClient } from '../http';
import { authMiddleware } from '../middleware';

export function executionRouter(orchestrator: IOrchestratorClient): Router {
  const router = Router();
  const protect = authMiddleware(orchestrator);

  // GET /executions — list executions (optionally filtered by ?status=)
  router.get('/', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as string | undefined;
      const executions = await orchestrator.listExecutions(req.orgId!, status);
      res.status(200).json(executions);
    } catch (err) {
      next(err);
    }
  });

  // POST /executions — trigger an execution by workflowId in body
  router.post('/', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId, input } = req.body as { workflowId?: string; input?: Record<string, unknown> };
      if (!workflowId) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'workflowId is required' } });
        return;
      }
      const execution = await orchestrator.triggerExecution(
        workflowId,
        input ?? {},
        req.user!.userId,
        req.orgId!,
      );
      res.status(201).json(execution);
    } catch (err) {
      next(err);
    }
  });

  // GET /executions/:id - get status
  router.get('/:id', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const execution = await orchestrator.getExecution(req.params.id, req.orgId!);
      res.status(200).json(execution);
    } catch (err) {
      next(err);
    }
  });

  // GET /executions/:id/events - full event log
  router.get('/:id/events', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await orchestrator.getExecutionEvents(req.params.id, req.orgId!);
      res.status(200).json(events);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
