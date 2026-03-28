import { Router, Request, Response, NextFunction } from 'express';
import { WorkflowService }    from '../services/WorkflowService';
import { ExecutionService }   from '../services/ExecutionService';
import { GraphQueryService }  from '../services/GraphQueryService';
import { ApiKeyService }      from '../services/ApiKeyService';
import { WebhookService }     from '../services/WebhookService';
import { CreateWorkflowSchema, TriggerExecutionSchema, ValidationError } from '@chronos/shared';

// Guards POST /api-keys when ADMIN_TOKEN env var is set.
// In dev (no ADMIN_TOKEN), the route is open for bootstrapping.
// In production, set ADMIN_TOKEN to a strong secret and pass it as X-Admin-Token.
function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    // No token configured — allow (dev/bootstrap mode)
    next();
    return;
  }
  const provided = req.headers['x-admin-token'];
  if (provided !== adminToken) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid admin token' } });
    return;
  }
  next();
}

const apiKeyService = new ApiKeyService();
const webhookService = new WebhookService();

export function internalRouter(
  workflowService: WorkflowService,
  executionService: ExecutionService,
  graphQueryService?: GraphQueryService,
): Router {
  const router = Router();

  // orgId is injected by the gateway via X-Org-Id header on every request.
  // Internal callers (e.g. scripts) may fall back to a default org for dev.
  function getOrgId(req: Request): string {
    return (req.headers['x-org-id'] as string | undefined) ?? 'default-org';
  }

  // ── Workflow endpoints ─────────────────────────────────────────────────

  router.post('/workflows', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = CreateWorkflowSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0].message);
      }
      const workflow = await workflowService.register({ ...parsed.data, orgId: getOrgId(req) });
      res.status(201).json(workflow);
    } catch (err) {
      next(err);
    }
  });

  router.get('/workflows', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflows = await workflowService.listAll(getOrgId(req));
      res.status(200).json(workflows);
    } catch (err) {
      next(err);
    }
  });

  router.get('/workflows/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflow = await workflowService.getById(req.params.id, getOrgId(req));
      res.status(200).json(workflow);
    } catch (err) {
      next(err);
    }
  });

  // ── Execution endpoints ────────────────────────────────────────────────

  router.get('/executions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as string | undefined;
      const executions = await executionService.listExecutions(getOrgId(req), status);
      res.status(200).json(executions);
    } catch (err) {
      next(err);
    }
  });

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
        userId ?? 'system',
        getOrgId(req),
      );
      res.status(201).json(execution);
    } catch (err) {
      next(err);
    }
  });

  router.get('/executions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const execution = await executionService.getExecution(req.params.id, getOrgId(req));
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

  // ── API key management ─────────────────────────────────────────────────

  // POST /internal/api-keys — create a new API key for an org.
  // The raw key is returned ONCE and never stored in plaintext.
  // Protected by requireAdminToken when ADMIN_TOKEN env var is set.
  router.post('/api-keys', requireAdminToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = (req.body.orgId as string | undefined) ?? getOrgId(req);
      const { userId, name } = req.body;
      if (!name) throw new ValidationError('name is required');
      const created = await apiKeyService.create(orgId, userId ?? 'system', name);
      // Also return a summary record so the dashboard can immediately show it in the list
      const [summary] = await apiKeyService.list(orgId);
      res.status(201).json({ key: summary, rawKey: created.rawKey });
    } catch (err) {
      next(err);
    }
  });

  // GET /internal/api-keys — list active keys for an org
  router.get('/api-keys', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = getOrgId(req);
      const keys = await apiKeyService.list(orgId);
      res.status(200).json(keys);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /internal/api-keys/:id — revoke a key
  router.delete('/api-keys/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = getOrgId(req);
      const ok = await apiKeyService.revoke(req.params.id, orgId);
      if (!ok) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API key not found' } });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // POST /internal/auth/validate-key — called by the gateway to authenticate API keys.
  router.post('/auth/validate-key', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key } = req.body;
      if (!key) throw new ValidationError('key is required');
      const result = await apiKeyService.validate(key);
      if (!result) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } });
        return;
      }
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // ── Graph query endpoints (Neo4j) ──────────────────────────────────────
  // Return 503 when Neo4j is unavailable (graphQueryService not wired).

  // GET /internal/graph/workflows-by-activity?activity=<activityName>
  router.get('/graph/workflows-by-activity', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!graphQueryService) {
        res.status(503).json({ error: { code: 'UNAVAILABLE', message: 'Graph database not available' } });
        return;
      }
      const activity = req.query.activity as string | undefined;
      if (!activity) throw new ValidationError('activity query param is required');
      const results = await graphQueryService.workflowsByActivity(activity);
      res.status(200).json(results);
    } catch (err) {
      next(err);
    }
  });

  // GET /internal/graph/failure-paths?orgId=<orgId>
  router.get('/graph/failure-paths', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!graphQueryService) {
        res.status(503).json({ error: { code: 'UNAVAILABLE', message: 'Graph database not available' } });
        return;
      }
      const orgId = (req.query.orgId as string | undefined) ?? getOrgId(req);
      const results = await graphQueryService.failurePaths(orgId);
      res.status(200).json(results);
    } catch (err) {
      next(err);
    }
  });

  // GET /internal/graph/bottlenecks?orgId=<orgId>
  router.get('/graph/bottlenecks', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!graphQueryService) {
        res.status(503).json({ error: { code: 'UNAVAILABLE', message: 'Graph database not available' } });
        return;
      }
      const orgId = (req.query.orgId as string | undefined) ?? getOrgId(req);
      const results = await graphQueryService.bottlenecks(orgId);
      res.status(200).json(results);
    } catch (err) {
      next(err);
    }
  });

  // GET /internal/graph/execution/:id
  router.get('/graph/execution/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!graphQueryService) {
        res.status(503).json({ error: { code: 'UNAVAILABLE', message: 'Graph database not available' } });
        return;
      }
      const results = await graphQueryService.executionGraph(req.params.id);
      res.status(200).json(results);
    } catch (err) {
      next(err);
    }
  });

  // GET /internal/graph/activity-impact?activity=<activityName>
  router.get('/graph/activity-impact', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!graphQueryService) {
        res.status(503).json({ error: { code: 'UNAVAILABLE', message: 'Graph database not available' } });
        return;
      }
      const activity = req.query.activity as string | undefined;
      if (!activity) throw new ValidationError('activity query param is required');
      const results = await graphQueryService.activityDependencyImpact(activity);
      res.status(200).json(results);
    } catch (err) {
      next(err);
    }
  });

  // ── Webhook management ─────────────────────────────────────────────────

  // GET /internal/webhooks — list webhooks for org
  router.get('/webhooks', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhooks = await webhookService.list(getOrgId(req));
      res.status(200).json(webhooks);
    } catch (err) {
      next(err);
    }
  });

  // GET /internal/webhooks/active — used by notifier to fetch dispatch targets
  router.get('/webhooks/active', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhooks = await webhookService.listActive(getOrgId(req));
      res.status(200).json(webhooks);
    } catch (err) {
      next(err);
    }
  });

  // POST /internal/webhooks — register a new webhook
  router.post('/webhooks', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url, events, secret } = req.body;
      if (!url) throw new ValidationError('url is required');
      if (!Array.isArray(events) || events.length === 0) throw new ValidationError('events must be a non-empty array');
      const webhook = await webhookService.create(getOrgId(req), { url, events, secret });
      res.status(201).json(webhook);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /internal/webhooks/:id — delete a webhook
  router.delete('/webhooks/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ok = await webhookService.delete(req.params.id, getOrgId(req));
      if (!ok) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
