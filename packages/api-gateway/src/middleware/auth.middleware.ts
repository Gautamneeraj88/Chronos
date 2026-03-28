import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '@chronos/shared';
import { IOrchestratorClient } from '../http/IOrchestratorClient';

export interface AuthUser {
  userId: string;
  orgId: string;
  role?: 'admin' | 'member';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      orgId?: string;
    }
  }
}

// A JWT is three base64url segments separated by dots.
// An API key has no dots.
function isJwt(token: string): boolean {
  return token.split('.').length === 3;
}

/**
 * Returns a middleware that validates a Bearer token.
 * Supports two token formats:
 *   1. API key  — validated via POST /internal/auth/validate-key (existing flow)
 *   2. JWT      — verified via GET /internal/auth/me
 *
 * On success sets req.user = { userId, orgId, role? } and req.orgId = orgId.
 */
export function authMiddleware(orchestratorClient: IOrchestratorClient) {
  return async function (req: Request, _res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Missing Bearer token'));
    }

    const rawToken = authHeader.slice(7);

    try {
      if (isJwt(rawToken)) {
        // JWT path — delegate to orchestrator /internal/auth/me
        const user = await orchestratorClient.me(rawToken);
        req.user = { userId: user.id, orgId: user.orgId, role: user.role };
        req.orgId = user.orgId;
        return next();
      }

      // API key path (legacy + service-to-service)
      const result = await orchestratorClient.validateApiKey(rawToken);
      if (!result) {
        return next(new UnauthorizedError('Invalid or revoked API key'));
      }
      req.user = { userId: result.userId, orgId: result.orgId };
      req.orgId = result.orgId;
      return next();
    } catch {
      return next(new UnauthorizedError('Auth service unavailable'));
    }
  };
}

/**
 * Middleware that requires req.user.role === 'admin'.
 * Must be used AFTER authMiddleware.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    return next(new UnauthorizedError('Admin role required'));
  }
  next();
}
