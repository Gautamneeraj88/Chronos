import { Router, Request, Response, NextFunction } from 'express';
import { IOrchestratorClient } from '../http';
import { authMiddleware } from '../middleware';

export function executionRouter(orchestrator: IOrchestratorClient): Router {
  const router = Router();
  const protect = authMiddleware(orchestrator);

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
