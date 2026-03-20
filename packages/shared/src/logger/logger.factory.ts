import winston from 'winston';

export interface LoggerMeta {
  [key: string]: unknown;
}

export interface ILogger {
  debug(message: string, meta?: LoggerMeta): void;
  info(message: string, meta?: LoggerMeta): void;
  warn(message: string, meta?: LoggerMeta): void;
  error(message: string, meta?: LoggerMeta): void;
}

export function createLogger(serviceName: string): ILogger {
  const isProduction = process.env.NODE_ENV === 'production';

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    defaultMeta: { service: serviceName },
    format: isProduction
      ? // INFO: Production: structured JSON — log aggregators parse this
        winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        )
      : // INFO: Development: human-readable coloured output
        winston.format.combine(
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.errors({ stack: true }),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, service, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
            return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
          }),
        ),
    transports: [new winston.transports.Console()],
  });

  return {
    debug: (message, meta) => logger.debug(message, meta),
    info: (message, meta) => logger.info(message, meta),
    warn: (message, meta) => logger.warn(message, meta),
    error: (message, meta) => logger.error(message, meta),
  };
}
