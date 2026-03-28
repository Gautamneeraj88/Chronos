import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { UnauthorizedError } from '@chronos/shared';

export function authRouter(authService: AuthService): Router {
  const router = Router();

  // POST /internal/auth/login
  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'email and password required' } });
        return;
      }
      const session = await authService.login(email, password);
      if (!session) {
        next(new UnauthorizedError('Invalid credentials'));
        return;
      }
      res.json(session);
    } catch (err) {
      next(err);
    }
  });

  // POST /internal/auth/register  (admin only — enforced by gateway JWT role check)
  router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, role, orgId } = req.body as {
        email?: string;
        password?: string;
        role?: string;
        orgId?: string;
      };
      if (!email || !password) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'email and password required' } });
        return;
      }
      const resolvedRole = role === 'admin' ? 'admin' : 'member';
      const resolvedOrg = (req.headers['x-org-id'] as string | undefined) ?? orgId ?? 'default-org';
      const user = await authService.register(email, password, resolvedOrg, resolvedRole);
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  });

  // GET /internal/auth/me
  router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        next(new UnauthorizedError('Missing Bearer token'));
        return;
      }
      const token = authHeader.slice(7);
      const user = await authService.verifyToken(token);
      res.json({ user });
    } catch {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  });

  // POST /internal/auth/refresh
  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        next(new UnauthorizedError('Missing Bearer token'));
        return;
      }
      const token = authHeader.slice(7);
      const session = await authService.refresh(token);
      res.json(session);
    } catch {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  });

  // GET /internal/auth/users  (admin only — lists all users in org)
  router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = (req.headers['x-org-id'] as string | undefined) ?? 'default-org';
      const users = await authService.listUsers(orgId);
      res.json({ users });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /internal/auth/users/:id  (admin only)
  router.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.deleteUser(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
