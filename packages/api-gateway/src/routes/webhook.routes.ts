import { Router, Request, Response, NextFunction } from 'express';
import { IOrchestratorClient } from '../http/IOrchestratorClient';
import { authMiddleware } from '../middleware/auth.middleware';

export function webhookRouter(orchestratorClient: IOrchestratorClient): Router {
  const router = Router();
  const auth = authMiddleware(orchestratorClient);

  // GET /webhooks — list all webhooks for the authenticated org
  router.get('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhooks = await orchestratorClient.listWebhooks(req.orgId!);
      res.json(webhooks);
    } catch (err) {
      next(err);
    }
  });

  // POST /webhooks — register a new webhook
  router.post('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url, events, secret } = req.body as { url: string; events: string[]; secret?: string };
      const webhook = await orchestratorClient.createWebhook(req.orgId!, { url, events, secret });
      res.status(201).json(webhook);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /webhooks/:id — remove a webhook
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
