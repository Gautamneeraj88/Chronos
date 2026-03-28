import { Router, Request, Response, NextFunction } from 'express';
import { IOrchestratorClient } from '../http/IOrchestratorClient';
import { authMiddleware, requireAdmin } from '../middleware/auth.middleware';
import { UnauthorizedError } from '@chronos/shared';

export function authRouter(orchestratorClient: IOrchestratorClient): Router {
  const router = Router();
  const auth = authMiddleware(orchestratorClient);

  // POST /auth/login — public, no auth required
  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'email and password required' } });
        return;
      }
      const session = await orchestratorClient.login(email, password);
      if (!session) {
        next(new UnauthorizedError('Invalid credentials'));
        return;
      }
      res.json(session);
    } catch (err) {
      next(err);
    }
  });

  // GET /auth/me — JWT required
  router.get('/me', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization!.slice(7);
      const user = await orchestratorClient.me(token);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  // POST /auth/refresh — JWT required
  router.post('/refresh', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization!.slice(7);
      const session = await orchestratorClient.refresh(token);
      res.json(session);
    } catch (err) {
      next(err);
    }
  });

  // POST /auth/register — admin only
  router.post('/register', auth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, role } = req.body as { email?: string; password?: string; role?: string };
      if (!email || !password) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'email and password required' } });
        return;
      }
      const token = req.headers.authorization!.slice(7);
      const user = await orchestratorClient.register(
        email,
        password,
        role ?? 'member',
        req.orgId!,
        token,
      );
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  });

  // GET /auth/users — admin only
  router.get('/users', auth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization!.slice(7);
      const users = await orchestratorClient.listUsers(req.orgId!, token);
      res.json({ users });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /auth/users/:id — admin only
  router.delete('/users/:id', auth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization!.slice(7);
      await orchestratorClient.deleteUser(req.params.id, token);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

// Separate router for /api-keys — mounted at /api-keys in app.ts
export function apiKeyRouter(orchestratorClient: IOrchestratorClient): Router {
  const router = Router();
  const auth = authMiddleware(orchestratorClient);

  router.get('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keys = await orchestratorClient.listApiKeys(req.orgId!);
      res.json(keys);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', auth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body as { name?: string };
      if (!name) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
        return;
      }
      const result = await orchestratorClient.createApiKey(req.orgId!, req.user!.userId, name);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', auth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await orchestratorClient.revokeApiKey(req.params.id, req.orgId!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
