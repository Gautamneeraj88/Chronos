import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '@chronos/shared';

export interface AuthUser {
  userId: string;
  email: string;
}

//NOTE: Extend Request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/* NOTE:
 * Returns a middleware function - takes jwtSecret as parameter
 * This means you can test it by passing a known secret
 */
export function authMiddleware(jwtSecret: string) {
  return function (req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Missing Bearer token'));
    }

    const token = authHeader.slice(7); //remove "Bearer "

    try {
      const payload = jwt.verify(token, jwtSecret) as AuthUser;
      req.user = { userId: payload.userId, email: payload.email };
      next();
    } catch {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  };
}
