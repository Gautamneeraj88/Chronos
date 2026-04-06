import './tracing'; // must be first — instruments libraries before they load
process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';
import 'dotenv/config';
import mongoose from 'mongoose';
import { loadConfig } from './config/config';
import { connectMongoDB } from './db/mongoose.connection';
import { connectRedis } from './db/redis.connection';
import { MongoWorkflowRepository } from './repositories/WorkflowRepository';
import { MongoExecutionRepository } from './repositories/ExecutionRepository';
import { MongoEventRepository } from './repositories/EventRepository';
import { RedisLockService } from './locks/RedisLockService';
import { RedisTimeoutStore } from './timeouts/RedisTimeoutStore';
import { SagaEngine } from './domain/SagaEngine';
import { WorkflowService } from './services/WorkflowService';
import { ExecutionService } from './services/ExecutionService';
import { StepPublisher } from './services/StepPublisher';
import { TimeoutChecker } from './services/TimeoutChecker';
import { ResultConsumer } from './services/ResultConsumer';
import { RecoveryEngine } from './recovery';
import { createApp } from './app';
import { createLogger } from '@chronos/shared';
import { KafkaClient } from '@chronos/kafka';
import { RabbitMQClient } from '@chronos/rabbitmq';
import { Neo4jClient } from '@chronos/neo4j';
import { NotificationPublisher } from './services/NotificationPublisher';
import { WorkflowGraphService } from './services/WorkflowGraphService';
import { GraphQueryService } from './services/GraphQueryService';
import { AuthService } from './services/AuthService';
import { MongoUserRepository } from './repositories/UserRepository';

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
  const timeoutStore = new RedisTimeoutStore(redis);
  const sagaEngine = new SagaEngine();
  const stepPublisher = new StepPublisher(kafkaClient);

  // 4b. Connect to RabbitMQ for execution notifications (optional — if unavailable, skip)
  let notificationPublisher: NotificationPublisher | undefined;
  try {
    const rabbitClient = RabbitMQClient.getInstance();
    await rabbitClient.connect();
    notificationPublisher = new NotificationPublisher(rabbitClient.getChannel());
    logger.info('RabbitMQ connected — NotificationPublisher ready');
  } catch (err) {
    logger.warn('RabbitMQ unavailable — notifications disabled', { err });
  }

  // 4c. Connect to Neo4j for workflow graph (optional — if unavailable, skip)
  let graphService: WorkflowGraphService | undefined;
  let graphQueryService: GraphQueryService | undefined;
  try {
    const neo4jClient = Neo4jClient.getInstance(
      config.neo4jUri,
      config.neo4jUsername,
      config.neo4jPassword,
    );
    await neo4jClient.verifyConnectivity();
    graphService = new WorkflowGraphService(neo4jClient);
    graphQueryService = new GraphQueryService(neo4jClient);
    logger.info('Neo4j connected — WorkflowGraphService + GraphQueryService ready');
  } catch (err) {
    logger.warn('Neo4j unavailable — graph sync disabled', { err });
  }

  // 5. Instantiate application services
  const userRepo = new MongoUserRepository();
  const authService = new AuthService(userRepo, config.jwtSecret);
  const workflowService = new WorkflowService(workflowRepo, graphService, redis);
  const executionService = new ExecutionService(
    executionRepo,
    eventRepo,
    workflowRepo,
    lockService,
    sagaEngine,
    stepPublisher,
    timeoutStore,
    notificationPublisher,
    graphService,
  );

  // 5b. Bootstrap first admin if no users exist (idempotent, safe on every restart)
  await authService.bootstrapIfEmpty(
    config.bootstrapAdminEmail,
    config.bootstrapAdminPassword,
    config.bootstrapOrgId,
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

  // 7. Create and start Express app — before consumer so health checks pass immediately
  const app = createApp({ workflowService, executionService, graphQueryService, authService, redis, kafkaClient });
  const server = app.listen(config.port, () => {
    logger.info('Orchestrator running', {
      port: config.port,
      env: config.nodeEnv,
    });
  });

  // 8. Start Kafka result consumer (non-blocking — consumer group join is async)
  const resultConsumer = new ResultConsumer(kafkaClient, executionService);
  await resultConsumer.start();

  // 9. Start timeout checker
  const timeoutChecker = new TimeoutChecker(timeoutStore, executionService);
  timeoutChecker.start();

  // 10. Graceful shutdown — drain in-flight sagas before closing connections
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — starting graceful shutdown`);

    // 1. Stop accepting new HTTP requests
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // 2. Disconnect Kafka (stops consumers from picking up new tasks, flushes producer)
    await kafkaClient.disconnect();

    // 3. Close DB connections
    await mongoose.disconnect();
    redis.disconnect();

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Orchestrator failed to start', err);
  process.exit(1);
});
