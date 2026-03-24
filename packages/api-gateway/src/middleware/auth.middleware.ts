import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '@chronos/shared';
import { IOrchestratorClient } from '../http/IOrchestratorClient';

export interface AuthUser {
  userId: string;
  orgId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      orgId?: string;
    }
  }
}

/**
 * Returns a middleware that validates an API key by calling the orchestrator.
 * On success, sets req.user = { userId, orgId } and req.orgId = orgId.
 *
 * The orchestratorClient dependency is injected so tests can pass a mock.
 */
export function authMiddleware(orchestratorClient: IOrchestratorClient) {
  return async function (req: Request, _res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Missing Bearer token'));
    }

    const rawKey = authHeader.slice(7);

    try {
      const result = await orchestratorClient.validateApiKey(rawKey);
      if (!result) {
        return next(new UnauthorizedError('Invalid or revoked API key'));
      }
      req.user = { userId: result.userId, orgId: result.orgId };
      req.orgId = result.orgId;
      next();
    } catch {
      next(new UnauthorizedError('Auth service unavailable'));
    }
  };
}
