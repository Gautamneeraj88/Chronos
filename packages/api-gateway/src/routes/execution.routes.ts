import { Router, Request, Response, NextFunction } from 'express';
import { IOrchestratorClient } from '../http';
import { authMiddleware } from '../middleware';
import { TriggerExecutionSchema, ValidationError } from '@chronos/shared';
import { loadConfig } from '../config/config';

export function executionRouter(orchestrator: IOrchestratorClient): Router {
  const router = Router();
  const config = loadConfig();
  const protect = authMiddleware(config.jwtSecret);

  /* NOTE:
   * POST /workflows/:workflowId/executions - trigger an execution
   * This route is mounted at /executions but the workflowId
   * comes from the path parameter
   */

  router.post(
    '/workflows/:workflowId/executions',
    protect,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = TriggerExecutionSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new ValidationError(parsed.error.issues[0].message);
        }

        const execution = await orchestrator.triggerExecution(
          req.params.workflowId,
          parsed.data.input,
          req.user!.userId,
        );
        res.status(201).json(execution);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /executions/:id - get status
  router.get('/:id', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const execution = await orchestrator.getExecution(req.params.id);
      res.status(200).json(execution);
    } catch (err) {
      next(err);
    }
  });

  // GET /executions/:id/events - full event log
  router.get('/:id/events', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await orchestrator.getExecutionEvents(req.params.id);
      res.status(200).json(events);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
