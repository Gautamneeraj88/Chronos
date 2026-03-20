import { Request, Response, NextFunction } from 'express';
import { ChronosError, createLogger } from '@chronos/shared';

const logger = createLogger('api-gateway');

// 4 arguments = Express identifies this as an error handler
// it only runs when next(error) is called upstream
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId ?? 'unknown';

  if (err instanceof ChronosError) {
    //Known error - send the right status createLogger
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
      },
    });
    return;
  }

  // Unknown error - log it fully, send generic 500
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
