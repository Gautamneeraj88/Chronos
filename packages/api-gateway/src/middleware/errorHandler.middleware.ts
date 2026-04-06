import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ChronosError, createLogger } from '@chronos/shared';

const logger = createLogger('api-gateway');

// 4 arguments = Express identifies this as an error handler
// it only runs when next(error) is called upstream
export function errorHandler(
  err: Error & { code?: number | string; name?: string },
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? 'unknown';

  if (err instanceof ChronosError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, requestId },
    });
    return;
  }

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message, requestId } });
    return;
  }

  // Mongoose CastError — invalid ObjectId / type mismatch
  if (err.name === 'CastError') {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid resource ID format', requestId } });
    return;
  }

  // Mongoose duplicate key (E11000)
  if (err.code === 11000) {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'Resource already exists', requestId } });
    return;
  }

  // Unknown error — log fully, send generic 500
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId,
    method: req.method,
    path: req.path,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    },
  });
}
