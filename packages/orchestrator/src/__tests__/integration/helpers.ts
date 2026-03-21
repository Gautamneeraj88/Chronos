import mongoose from 'mongoose';
import Redis from 'ioredis';
import { Express } from 'express';
import { MongoWorkflowRepository }  from '../../repositories/WorkflowRepository';
import { MongoExecutionRepository } from '../../repositories/ExecutionRepository';
import { MongoEventRepository }     from '../../repositories/EventRepository';
import { RedisLockService }         from '../../locks/RedisLockService';
import { SagaEngine }               from '../../domain/SagaEngine';
import { ActivityRunner }           from '../../activities/ActivityRunner';
import { WorkflowService }          from '../../services/WorkflowService';
import { ExecutionService }         from '../../services/ExecutionService';
import { createApp }                from '../../app';

const MONGO_URI = 'mongodb://chronos:chronos_dev@localhost:27017/chronos_test?authSource=admin';
const REDIS_URL = 'redis://localhost:6379';

let redisClient: Redis;

export async function buildTestApp(): Promise<Express> {
  await mongoose.connect(MONGO_URI);
  redisClient = new Redis(REDIS_URL);

  const workflowRepo   = new MongoWorkflowRepository();
  const executionRepo  = new MongoExecutionRepository();
  const eventRepo      = new MongoEventRepository();
  const lockService    = new RedisLockService(redisClient);
  const sagaEngine     = new SagaEngine();
  const activityRunner = new ActivityRunner();

  const workflowService  = new WorkflowService(workflowRepo);
  const executionService = new ExecutionService(
    executionRepo,
    eventRepo,
    workflowRepo,
    lockService,
    sagaEngine,
    activityRunner,
  );

  return createApp({ workflowService, executionService });
}

export async function cleanDatabase(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  const keys = await redisClient.keys('lock:*');
  if (keys.length > 0) await redisClient.del(...keys);
}

export async function teardown(): Promise<void> {
  await mongoose.disconnect();
  await redisClient.quit();
}

export const sampleWorkflow = {
  name: 'test-order-processing',
  steps: [
    { name: 'charge-card',       type: 'activity', retries: 3, timeoutMs: 5000, compensation: 'refund-card' },
    { name: 'update-inventory',  type: 'activity', retries: 3, timeoutMs: 5000, compensation: 'restore-inventory' },
    { name: 'send-confirmation', type: 'activity', retries: 2, timeoutMs: 5000, compensation: null },
  ],
};
