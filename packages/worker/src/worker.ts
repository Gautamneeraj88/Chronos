import { KafkaClient, TOPICS } from '@chronos/kafka';
import { StepExecuteMessage, StepResultMessage, createLogger } from '@chronos/shared';
import { ActivityRunner } from './activities/ActivityRunner';
type Producer = Awaited<ReturnType<KafkaClient['getProducer']>>;

const logger = createLogger('worker');

export class Worker {
  private readonly GROUP_ID = 'chronos-workers';
  private activityRunner: ActivityRunner;
  private kafkaClient: KafkaClient;
  private workerId: string;

  constructor(kafkaClient: KafkaClient, workerId: string) {
    this.kafkaClient = kafkaClient;
    this.workerId = workerId;
    this.activityRunner = new ActivityRunner();
  }

  async start(): Promise<void> {
    const consumer = await this.kafkaClient.getConsumer(this.GROUP_ID);
    const producer = await this.kafkaClient.getProducer();

    await consumer.subscribe({
      topic: TOPICS.STEP_EXECUTE,
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ message, partition }) => {
        const raw = message.value?.toString();
        if (!raw) {
          logger.warn('Received empty message', { partition });
          return;
        }

        let payload: StepExecuteMessage;
        try {
          payload = JSON.parse(raw) as StepExecuteMessage;
        } catch (err) {
          logger.error('Failed to parse step execute message', { raw, err });
          return;
        }

        logger.info('Step received', {
          workerId: this.workerId,
          executionId: payload.executionId,
          stepId: payload.stepId,
          activityName: payload.activityName,
          partition,
        });

        await this.executeAndPublishResult(payload, producer);
      },
    });

    logger.info('Worker started', {
      workerId: this.workerId,
      groupId: this.GROUP_ID,
    });
  }

  private async executeAndPublishResult(
    payload: StepExecuteMessage,
    producer: Producer,
  ): Promise<void> {
    const { executionId, stepId, activityName, input, attemptNumber } = payload;

    // Idempotency guard — log the attempt
    logger.debug('Executing activity', {
      executionId,
      stepId,
      activityName,
      attemptNumber,
    });

    let result: StepResultMessage;

    try {
      const output = await this.activityRunner.execute(
        // ActivityRunner expects a WorkflowStep shape
        { name: stepId, type: 'activity' as const, activity: activityName, retries: 3, timeoutMs: 30_000, compensation: null },
        input,
      );

      result = {
        executionId,
        stepId,
        success: true,
        output: output as Record<string, unknown>,
      };

      logger.info('Activity succeeded', { executionId, stepId });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);

      result = {
        executionId,
        stepId,
        success: false,
        output: {},
        error,
      };

      logger.warn('Activity failed', { executionId, stepId, error });
    }

    // Publish result back to orchestrator
    await producer.send({
      topic: TOPICS.STEP_RESULT,
      messages: [
        {
          key: executionId,
          value: JSON.stringify(result),
        },
      ],
    });

    logger.debug('Result published', { executionId, stepId, success: result.success });
  }
}
