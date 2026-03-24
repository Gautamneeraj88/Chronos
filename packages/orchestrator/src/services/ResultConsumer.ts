import { KafkaClient, TOPICS } from "@chronos/kafka";
import { StepResultMessage, createLogger } from "@chronos/shared";
import { ExecutionService } from "./ExecutionService";

const logger = createLogger('orchestrator');

export class ResultConsumer {
  private client: KafkaClient;
  private executionService: ExecutionService;
  private readonly GROUP_ID = 'chronos-orchestrator';

  constructor(client: KafkaClient, executionService: ExecutionService) {
    this.client = client;
    this.executionService = executionService;
  }

  async start(): Promise<void> {
    const consumer = await this.client.getConsumer(this.GROUP_ID);

    await consumer.subscribe({
      topic: TOPICS.STEP_RESULT,
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ message, partition, topic}) => {
        const raw = message.value?.toString();
        if(!raw) {
          logger.warn('Received empty message', { topic, partition});
          return;
        }

        let parsed: StepResultMessage;
        try {
          parsed = JSON.parse(raw) as StepResultMessage;
        } catch (err) {
          logger.error('Failed to parse step result message', { raw, err });
          return;
        }

        logger.info('Step result received', {
          executionId: parsed.executionId,
          stepId: parsed.stepId,
          success: parsed.success,
        });

        try {
          await this.executionService.handleStepResult(parsed);
        } catch (err) {
          // Log but don't rethrow - a crash here would stop the consumer
          // In Week 11 we'll add a dead letter queue for failed results
          logger.error('Failed to handle step result', {
            executionId: parsed.executionId,
            stepId: parsed.stepId,
            err,
          });
        }
      },
    });

    logger.info('ResultConsumer started', { groupId: this.GROUP_ID });
  }
}
