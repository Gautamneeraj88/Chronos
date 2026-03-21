import mongoose, { Connection } from 'mongoose';
import { createLogger } from '@chronos/shared';

const logger = createLogger('orchestrator');

export async function connectMongoDB(uri: string): Promise<Connection> {
  /* NOTE:
   * useNewUrlParser and useUnifiedTopology are defaults in mongoose 7+
   * but setting them explicitly makes the intent clear
   */
  await mongoose.connect(uri);

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
