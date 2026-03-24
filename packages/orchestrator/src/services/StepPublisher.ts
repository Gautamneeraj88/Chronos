import { KafkaClient, TOPICS } from "@chronos/kafka";
import { StepExecuteMessage, createLogger } from "@chronos/shared";

const logger = createLogger('orchestrator');

export class StepPublisher {
  private client: KafkaClient;

  constructor(client: KafkaClient){
    this.client = client;
  }

  async publish(message: StepExecuteMessage): Promise<void> {
    const producer = await this.client.getProducer()

    await producer.send({
      topic: TOPICS.STEP_EXECUTE,
      messages: [
        {
          // Partition by executionId - all steps of the same execution
          // go to the same partition, preserving order
          key: message.executionId,
          value: JSON.stringify(message),
        },
      ],
    });

    logger.info('Step published to Kafka', {
      executionId: message.executionId,
      stepId: message.stepId,
      activityName: message.activityName,
      attemptNumber: message.attemptNumber,
    });
  }
}
