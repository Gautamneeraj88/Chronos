import { ExecutionNotification } from '@chronos/shared';

// Duck-typed subset of amqplib.Channel — avoids a direct amqplib dep in orchestrator
interface PublishChannel {
  publish(exchange: string, routingKey: string, content: Buffer, options?: Record<string, unknown>): boolean;
}
import { EXECUTION_EVENTS_EXCHANGE, routingKey } from '@chronos/rabbitmq';
import { createLogger } from '@chronos/shared';

const logger = createLogger('orchestrator');

/**
 * Publishes execution lifecycle notifications to the RabbitMQ topic exchange.
 * Fire-and-forget — errors are logged but never propagate to the caller.
 */
export class NotificationPublisher {
  constructor(private readonly channel: PublishChannel) {}

  publish(notification: ExecutionNotification): void {
    const key = routingKey(
      notification.status === 'COMPLETED' ? 'completed' : 'failed',
      notification.orgId,
    );
    const body = Buffer.from(JSON.stringify(notification));
    try {
      this.channel.publish(EXECUTION_EVENTS_EXCHANGE, key, body, {
        persistent: true,
        contentType: 'application/json',
      });
    } catch (err) {
      logger.error('NotificationPublisher: failed to publish', {
        executionId: notification.executionId,
        err,
      });
    }
  }
}
