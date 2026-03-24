import { KafkaClient, TOPICS } from '@chronos/kafka';
import { StepResultMessage, DlqMessage, createLogger } from '@chronos/shared';
import { ExecutionService } from './ExecutionService';

const logger = createLogger('orchestrator');

type Producer = Awaited<ReturnType<KafkaClient['getProducer']>>;

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
    const producer = await this.client.getProducer();

    await consumer.subscribe({
      topic: TOPICS.STEP_RESULT,
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ message, partition, topic }) => {
        const raw = message.value?.toString() ?? '';
        if (!raw) {
          logger.warn('Received empty message', { topic, partition });
          return;
        }

        let parsed: StepResultMessage;
        try {
          parsed = JSON.parse(raw) as StepResultMessage;
        } catch (err) {
          logger.error('Failed to parse step result message — routing to DLQ', { raw, err });
          await this.sendToDlq(producer, topic, raw, 'JSON parse error');
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

  private async sendToDlq(
    producer: Producer,
    originalTopic: string,
    originalPayload: string,
    reason: string,
    executionId?: string,
    stepId?: string,
  ): Promise<void> {
    const dlq: DlqMessage = {
      originalTopic,
      originalPayload,
      reason,
      failedAt: new Date().toISOString(),
      executionId,
      stepId,
    };
    await producer.send({
      topic: TOPICS.STEP_DLQ,
      messages: [{ value: JSON.stringify(dlq) }],
    });
    logger.warn('Message sent to DLQ', { originalTopic, reason, executionId, stepId });
  }
}
