import { Router, Request, Response, NextFunction } from 'express';
import { IOrchestratorClient } from '../http';
import { authMiddleware } from '../middleware';

export function executionRouter(orchestrator: IOrchestratorClient): Router {
  const router = Router();
  const protect = authMiddleware(orchestrator);

  /**
   * @openapi
   * /executions:
   *   get:
   *     summary: List executions for the org
   *     tags: [Executions]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [RUNNING, COMPLETED, COMPENSATING, COMPENSATED, COMPENSATION_FAILED]
   *         description: Filter by execution status
   *     responses:
   *       200:
   *         description: Array of executions
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Execution'
   *       401:
   *         description: Unauthorized
   */
  router.get('/', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as string | undefined;
      const executions = await orchestrator.listExecutions(req.orgId!, status);
      res.status(200).json(executions);
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /executions:
   *   post:
   *     summary: Trigger an execution by workflowId
   *     tags: [Executions]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [workflowId]
   *             properties:
   *               workflowId:
   *                 type: string
   *               input:
   *                 type: object
   *                 additionalProperties: true
   *     responses:
   *       201:
   *         description: Execution started
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Execution'
   *       400:
   *         description: workflowId is required
   *       401:
   *         description: Unauthorized
   */
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

  /**
   * @openapi
   * /executions/{id}:
   *   get:
   *     summary: Get execution status
   *     tags: [Executions]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Execution object
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Execution'
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Not found
   */
  router.get('/:id', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const execution = await orchestrator.getExecution(req.params.id, req.orgId!);
      res.status(200).json(execution);
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /executions/{id}/events:
   *   get:
   *     summary: Get the full append-only event log for an execution
   *     tags: [Executions]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Ordered array of execution events
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/ExecutionEvent'
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Not found
   */
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
