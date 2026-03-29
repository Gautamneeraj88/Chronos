import { Router, Request, Response, NextFunction } from 'express';
import { IOrchestratorClient } from '../http/IOrchestratorClient';
import { authMiddleware } from '../middleware/auth.middleware';

export function webhookRouter(orchestratorClient: IOrchestratorClient): Router {
  const router = Router();
  const auth = authMiddleware(orchestratorClient);

  /**
   * @openapi
   * /webhooks:
   *   get:
   *     summary: List all webhooks for the org
   *     tags: [Webhooks]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Array of webhooks
   *       401:
   *         description: Unauthorized
   */
  router.get('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhooks = await orchestratorClient.listWebhooks(req.orgId!);
      res.json(webhooks);
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /webhooks:
   *   post:
   *     summary: Register a new webhook
   *     tags: [Webhooks]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [url, events]
   *             properties:
   *               url:
   *                 type: string
   *                 example: https://example.com/hooks/chronos
   *               events:
   *                 type: array
   *                 items:
   *                   type: string
   *                   enum: [execution.started, execution.completed, execution.compensated, execution.failed, step.completed, step.failed]
   *               secret:
   *                 type: string
   *                 description: Optional HMAC-SHA256 signing secret
   *     responses:
   *       201:
   *         description: Webhook registered
   *       401:
   *         description: Unauthorized
   */
  router.post('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url, events, secret } = req.body as { url: string; events: string[]; secret?: string };
      const webhook = await orchestratorClient.createWebhook(req.orgId!, { url, events, secret });
      res.status(201).json(webhook);
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /webhooks/{id}:
   *   delete:
   *     summary: Remove a webhook
   *     tags: [Webhooks]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Webhook deleted
   *       401:
   *         description: Unauthorized
   */
  router.delete('/:id', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await orchestratorClient.deleteWebhook(req.params.id, req.orgId!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
