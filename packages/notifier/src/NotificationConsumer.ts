import { ExecutionNotification } from '@chronos/shared';
import { RabbitMQClient, EXECUTION_EVENTS_EXCHANGE } from '@chronos/rabbitmq';
import { createLogger } from '@chronos/shared';

const logger = createLogger('notifier');

export type NotificationHandler = (notification: ExecutionNotification) => void | Promise<void>;

// Duck-typed subset of amqplib.Channel — avoids a direct amqplib dep in notifier
interface ConsumeChannel {
  assertQueue(queue: string, options?: Record<string, unknown>): Promise<{ queue: string }>;
  bindQueue(queue: string, source: string, pattern: string): Promise<unknown>;
  consume(queue: string, onMessage: (msg: ConsumeMessage | null) => void): Promise<unknown>;
  ack(msg: ConsumeMessage): void;
  nack(msg: ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void;
}

interface ConsumeMessage {
  content: Buffer;
}

/**
 * Consumes execution notifications from the RabbitMQ topic exchange.
 * Binds to a queue with the given routing pattern (e.g. 'execution.#' for all orgs).
 */
export class NotificationConsumer {
  constructor(
    private readonly client: RabbitMQClient,
    private readonly queueName: string,
    private readonly routingPattern: string,
    private readonly handlers: NotificationHandler[],
  ) {}

  async start(): Promise<void> {
    const channel = this.client.getChannel() as unknown as ConsumeChannel;

    const { queue } = await channel.assertQueue(this.queueName, {
      durable: true,
      arguments: { 'x-queue-type': 'quorum' },
    });

    await channel.bindQueue(queue, EXECUTION_EVENTS_EXCHANGE, this.routingPattern);

    await channel.consume(queue, async (msg) => {
      if (!msg) return;

      try {
        const notification: ExecutionNotification = JSON.parse(msg.content.toString());
        for (const handler of this.handlers) {
          await handler(notification);
        }
        channel.ack(msg);
      } catch (err) {
        logger.error('NotificationConsumer: failed to process message', { err });
        channel.nack(msg, false, false); // dead-letter without requeue
      }
    });

    logger.info('NotificationConsumer started', {
      queue: this.queueName,
      pattern: this.routingPattern,
    });
  }
}
