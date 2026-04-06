import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ChronosError, createLogger } from '@chronos/shared';

const logger = createLogger('orchestrator');

export function errorHandler(
  err: Error & { code?: number | string; name?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ChronosError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
    return;
  }

  // Mongoose CastError — invalid ObjectId / type mismatch
  if (err.name === 'CastError') {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid resource ID format' } });
    return;
  }

  // Mongoose duplicate key (E11000)
  if (err.code === 11000) {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'Resource already exists' } });
    return;
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
