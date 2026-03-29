import { Router, Request, Response, NextFunction } from 'express';
import { IOrchestratorClient } from '../http/IOrchestratorClient';
import { authMiddleware, requireAdmin } from '../middleware/auth.middleware';
import { UnauthorizedError } from '@chronos/shared';

export function authRouter(orchestratorClient: IOrchestratorClient): Router {
  const router = Router();
  const auth = authMiddleware(orchestratorClient);

  /**
   * @openapi
   * /auth/login:
   *   post:
   *     summary: Exchange email + password for a JWT
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email:
   *                 type: string
   *                 example: admin@example.com
   *               password:
   *                 type: string
   *                 example: your-password
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                 user:
   *                   $ref: '#/components/schemas/User'
   *       400:
   *         description: Missing email or password
   *       401:
   *         description: Invalid credentials
   */
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

  /**
   * @openapi
   * /auth/me:
   *   get:
   *     summary: Return the current authenticated user
   *     tags: [Auth]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Current user
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user:
   *                   $ref: '#/components/schemas/User'
   *       401:
   *         description: Unauthorized
   */
  router.get('/me', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization!.slice(7);
      const user = await orchestratorClient.me(token);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /auth/refresh:
   *   post:
   *     summary: Refresh JWT before expiry
   *     tags: [Auth]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: New token
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *       401:
   *         description: Unauthorized
   */
  router.post('/refresh', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization!.slice(7);
      const session = await orchestratorClient.refresh(token);
      res.json(session);
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /auth/register:
   *   post:
   *     summary: Create a new user (admin only)
   *     tags: [Auth]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *               role:
   *                 type: string
   *                 enum: [admin, member]
   *                 default: member
   *     responses:
   *       201:
   *         description: User created
   *       400:
   *         description: Missing fields
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Admin role required
   */
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

  /**
   * @openapi
   * /auth/users:
   *   get:
   *     summary: List all users in the org (admin only)
   *     tags: [Auth]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: List of users
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Admin role required
   */
  router.get('/users', auth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization!.slice(7);
      const users = await orchestratorClient.listUsers(req.orgId!, token);
      res.json({ users });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /auth/users/{id}:
   *   delete:
   *     summary: Delete a user by ID (admin only)
   *     tags: [Auth]
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
   *         description: User deleted
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Admin role required
   */
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

  /**
   * @openapi
   * /api-keys:
   *   get:
   *     summary: List all API keys for the org
   *     tags: [API Keys]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: List of API keys (secret not included)
   *       401:
   *         description: Unauthorized
   */
  router.get('/', auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keys = await orchestratorClient.listApiKeys(req.orgId!);
      res.json(keys);
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api-keys:
   *   post:
   *     summary: Create a new API key (admin only)
   *     tags: [API Keys]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name:
   *                 type: string
   *                 example: ci-pipeline
   *     responses:
   *       201:
   *         description: API key created — key field only present in this response
   *       400:
   *         description: Name is required
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Admin role required
   */
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

  /**
   * @openapi
   * /api-keys/{id}:
   *   delete:
   *     summary: Revoke an API key (admin only)
   *     tags: [API Keys]
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
   *         description: API key revoked
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Admin role required
   */
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
