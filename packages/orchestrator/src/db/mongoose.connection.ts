import mongoose, { Connection } from 'mongoose';
import { createLogger } from '@chronos/shared';

const logger = createLogger('orchestrator');

export async function connectMongoDB(uri: string): Promise<Connection> {
  await mongoose.connect(uri, {
    maxPoolSize: 20,              // default is 5 — too low under concurrent load
    minPoolSize: 5,
    socketTimeoutMS: 45_000,
    serverSelectionTimeoutMS: 5_000,
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB error', { error: err.message });
  });

  logger.info('MongoDB connected');
  return mongoose.connection;
}

export async function disconnectedMongoDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected cleanly');
}
