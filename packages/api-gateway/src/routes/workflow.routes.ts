import { Router, Request, Response, NextFunction } from 'express';
import { IOrchestratorClient } from '../http';
import { authMiddleware } from '../middleware';
import { CreateWorkflowSchema, TriggerExecutionSchema, ValidationError } from '@chronos/shared';

export function workflowRouter(orchestrator: IOrchestratorClient): Router {
  const router = Router();
  const protect = authMiddleware(orchestrator);

  /**
   * @openapi
   * /workflows:
   *   post:
   *     summary: Register a new workflow definition
   *     tags: [Workflows]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateWorkflowInput'
   *     responses:
   *       201:
   *         description: Workflow created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Workflow'
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */
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

  /**
   * @openapi
   * /workflows:
   *   get:
   *     summary: List all workflow definitions for the org
   *     tags: [Workflows]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Array of workflow definitions
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Workflow'
   *       401:
   *         description: Unauthorized
   */
  router.get('/', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflows = await orchestrator.listWorkflows(req.orgId!);
      res.status(200).json(workflows);
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /workflows/{id}:
   *   get:
   *     summary: Get a workflow definition by ID
   *     tags: [Workflows]
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
   *         description: Workflow definition
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Workflow'
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Not found
   */
  router.get('/:id', protect, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflow = await orchestrator.getWorkflow(req.params.id, req.orgId!);
      res.status(200).json(workflow);
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /workflows/{id}/executions:
   *   post:
   *     summary: Trigger an execution for a workflow
   *     tags: [Workflows]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Workflow ID
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               input:
   *                 type: object
   *                 additionalProperties: true
   *                 example: { orderId: "ORD-001", amount: 99.99 }
   *     responses:
   *       201:
   *         description: Execution started
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Execution'
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Workflow not found
   */
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
