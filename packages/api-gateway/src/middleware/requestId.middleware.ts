import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

//Extend Express Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  /* NOTE:
   * Use incoming header if present (useful when gateway is behind a load balancer)
   * otherwise generate a fresh UUID
   */
  req.requestId = (req.headers['x-request-id'] as string) ?? uuidv4();
  res.setHeader('x-request-id', req.requestId);
  next();
}
