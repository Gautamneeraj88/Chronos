import { Router, Request, Response, NextFunction } from 'express';
import { WorkflowService }   from '../services/WorkflowService';
import { ExecutionService }  from '../services/ExecutionService';
import { ApiKeyService }     from '../services/ApiKeyService';
import { CreateWorkflowSchema, TriggerExecutionSchema, ValidationError } from '@chronos/shared';

const apiKeyService = new ApiKeyService();

export function internalRouter(
  workflowService: WorkflowService,
  executionService: ExecutionService
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
  router.post('/api-keys', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId, userId, name } = req.body;
      if (!orgId || !name) throw new ValidationError('orgId and name are required');
      const created = await apiKeyService.create(orgId, userId ?? 'system', name);
      res.status(201).json({
        key: created.rawKey,
        orgId: created.orgId,
        name: created.name,
      });
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

  return router;
}
