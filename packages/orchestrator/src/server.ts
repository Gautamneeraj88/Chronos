import 'dotenv/config';
import { loadConfig } from './config/config';
import { connectMongoDB } from './db/mongoose.connection';
import { connectRedis } from './db/redis.connection';
import { MongoWorkflowRepository } from './repositories/WorkflowRepository';
import { MongoExecutionRepository } from './repositories/ExecutionRepository';
import { MongoEventRepository } from './repositories/EventRepository';
import { RedisLockService } from './locks/RedisLockService';
import { SagaEngine } from './domain/SagaEngine';
import { WorkflowService } from './services/WorkflowService';
import { ExecutionService } from './services/ExecutionService';
import { StepPublisher } from './services/StepPublisher';
import { ResultConsumer } from './services/ResultConsumer';
import { RecoveryEngine } from './recovery';
import { createApp } from './app';
import { createLogger } from '@chronos/shared';
import { KafkaClient } from '@chronos/kafka';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger('orchestrator');

  // 1. Connect to infrastructure
  await connectMongoDB(config.mongoUri);
  const redis = connectRedis(config.redisUri);

  // 2. Connect to Kafka
  const kafkaClient = KafkaClient.getInstance({
    clientId: 'chronos-orchestrator',
    brokers: config.kafkaBrokers.split(','),
  });

  // 3. Instantiate repositories
  const workflowRepo = new MongoWorkflowRepository();
  const executionRepo = new MongoExecutionRepository();
  const eventRepo = new MongoEventRepository();

  // 4. Instantiate domain + infrastructure services
  const lockService = new RedisLockService(redis);
  const sagaEngine = new SagaEngine();
  const stepPublisher = new StepPublisher(kafkaClient);

  // 5. Instantiate application services
  const workflowService = new WorkflowService(workflowRepo);
  const executionService = new ExecutionService(
    executionRepo,
    eventRepo,
    workflowRepo,
    lockService,
    sagaEngine,
    stepPublisher,
  );

  // 6. Recovery — MUST complete before accepting requests
  const recoveryEngine = new RecoveryEngine(
    executionRepo,
    eventRepo,
    workflowRepo,
    executionService,
    lockService,
  );
  await recoveryEngine.recoverInFlightExecutions();

  // 7. Start Kafka result consumer
  const resultConsumer = new ResultConsumer(kafkaClient, executionService);
  await resultConsumer.start();

  // 8. Create and start Express app
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
