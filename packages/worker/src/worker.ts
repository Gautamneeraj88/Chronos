import { KafkaClient, TOPICS } from '@chronos/kafka';
import { StepExecuteMessage, StepResultMessage, DlqMessage, createLogger } from '@chronos/shared';
import { ActivityRunner } from './activities/ActivityRunner';
import { stepDuration, stepAttempts } from './metrics/metrics';
type Producer = Awaited<ReturnType<KafkaClient['getProducer']>>;

const logger = createLogger('worker');

export class Worker {
  private readonly GROUP_ID = process.env.KAFKA_GROUP_ID ?? 'chronos-workers';
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
          logger.error('Failed to parse step execute message — routing to DLQ', { raw, err });
          await this.sendToDlq(producer, TOPICS.STEP_EXECUTE, raw, 'JSON parse error');
          return;
        }

        logger.info('Step received', {
          workerId: this.workerId,
          executionId: payload.executionId,
          stepId: payload.stepId,
          activityName: payload.activityName,
          traceId: payload.traceId,
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

  private async sendToDlq(
    producer: Producer,
    originalTopic: string,
    originalPayload: string,
    reason: string,
  ): Promise<void> {
    const dlq: DlqMessage = {
      originalTopic,
      originalPayload,
      reason,
      failedAt: new Date().toISOString(),
    };
    await producer.send({
      topic: TOPICS.STEP_DLQ,
      messages: [{ value: JSON.stringify(dlq) }],
    });
    logger.warn('Message sent to DLQ', { originalTopic, reason });
  }

  private async executeAndPublishResult(
    payload: StepExecuteMessage,
    producer: Producer,
  ): Promise<void> {
    const { executionId, stepId, activityName, input, attemptNumber, retries } = payload;

    logger.debug('Executing activity', { executionId, stepId, activityName, attemptNumber });

    const startMs = Date.now();
    try {
      const output = await this.activityRunner.execute(
        { name: stepId, type: 'activity' as const, activity: activityName, retries, timeoutMs: payload.timeoutMs, compensation: null },
        input,
        attemptNumber,
      );

      stepDuration.observe({ activityName, success: 'true' }, Date.now() - startMs);
      stepAttempts.inc({ activityName, success: 'true' });

      const result: StepResultMessage = {
        executionId,
        stepId,
        success: true,
        output: output as Record<string, unknown>,
      };

      logger.info('Activity succeeded', { executionId, stepId, attemptNumber });

      await producer.send({
        topic: TOPICS.STEP_RESULT,
        messages: [{ key: executionId, value: JSON.stringify(result) }],
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      stepDuration.observe({ activityName, success: 'false' }, Date.now() - startMs);
      stepAttempts.inc({ activityName, success: 'false' });
      logger.warn('Activity failed', { executionId, stepId, attemptNumber, error });

      if (attemptNumber <= retries) {
        // Exponential backoff before retrying: 1s, 2s, 4s, … capped at 30s
        const delayMs = Math.min(1000 * Math.pow(2, attemptNumber - 1), 30_000);
        logger.info('Retrying step', { executionId, stepId, nextAttempt: attemptNumber + 1, delayMs });
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        await producer.send({
          topic: TOPICS.STEP_EXECUTE,
          messages: [{ key: executionId, value: JSON.stringify({ ...payload, attemptNumber: attemptNumber + 1 }) }],
        });
      } else {
        // All retries exhausted — report failure to orchestrator
        const result: StepResultMessage = {
          executionId,
          stepId,
          success: false,
          output: {},
          error,
        };
        await producer.send({
          topic: TOPICS.STEP_RESULT,
          messages: [{ key: executionId, value: JSON.stringify(result) }],
        });
      }
    }
  }
}
