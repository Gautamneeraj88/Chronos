import 'dotenv/config';
import { loadConfig } from './config/config';
import { connectMongoDB } from './db/mongoose.connection';
import { connectRedis } from './db/redis.connection';
import { MongoWorkflowRepository } from './repositories/WorkflowRepository';
import { MongoExecutionRepository } from './repositories/ExecutionRepository';
import { MongoEventRepository } from './repositories/EventRepository';
import { RedisLockService } from './locks/RedisLockService';
import { SagaEngine } from './domain/SagaEngine';
import { ActivityRunner } from './activities/ActivityRunner';
import { WorkflowService } from './services/WorkflowService';
import { ExecutionService } from './services/ExecutionService';
import { RecoveryEngine } from './recovery';
import { createApp } from './app';
import { createLogger } from '@chronos/shared';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger('orchestrator');

  // 1. Connect to infrastructure
  await connectMongoDB(config.mongoUri);
  const redis = connectRedis(config.redisUri);

  // 2. Instantiate repositories
  const workflowRepo = new MongoWorkflowRepository();
  const executionRepo = new MongoExecutionRepository();
  const eventRepo = new MongoEventRepository();

  // 3. Instantiate domain + infrastructure services
  const lockService = new RedisLockService(redis);
  const sagaEngine = new SagaEngine();
  const activityRunner = new ActivityRunner();

  // 4. Instantiate application services
  const workflowService = new WorkflowService(workflowRepo);
  const executionService = new ExecutionService(
    executionRepo,
    eventRepo,
    workflowRepo,
    lockService,
    sagaEngine,
    activityRunner,
  );

  // 5. Recovery - MUST complete before acceptiong requests
  const recoveryEngine = new RecoveryEngine(
    executionRepo,
    eventRepo,
    workflowRepo,
    executionService,
    lockService,
  );
  await recoveryEngine.recoverInFlightExecutions();

  // 6. Create and start Express app
  const app = createApp({ workflowService, executionService });

  app.listen(config.port, () => {
    logger.info('Orchestrator running', {
      port: config.port,
      env: config.nodeEnv,
    });
  });
}

bootstrap().catch((err) => {
  console.error('Orchestrator failed to start', err);
  process.exit(1);
});
