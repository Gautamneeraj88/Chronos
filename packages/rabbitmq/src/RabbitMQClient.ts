import * as amqplib from 'amqplib';
import { EXECUTION_EVENTS_EXCHANGE, EXCHANGE_TYPE } from './exchanges';

/**
 * Singleton RabbitMQ client.
 * Call RabbitMQClient.getInstance() to get the shared instance.
 * Call connect() once at startup before publishing or consuming.
 */
export class RabbitMQClient {
  private static instance: RabbitMQClient;

  private model: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  private constructor(private readonly url: string) {}

  static getInstance(url?: string): RabbitMQClient {
    if (!RabbitMQClient.instance) {
      const resolvedUrl =
        url ?? process.env.RABBITMQ_URL ?? 'amqp://chronos:chronos_dev@localhost:5672';
      RabbitMQClient.instance = new RabbitMQClient(resolvedUrl);
    }
    return RabbitMQClient.instance;
  }

  async connect(): Promise<void> {
    this.model = await amqplib.connect(this.url);
    this.channel = await this.model.createChannel();

    // Declare the exchange once — idempotent
    await this.channel.assertExchange(EXECUTION_EVENTS_EXCHANGE, EXCHANGE_TYPE, {
      durable: true,
    });
  }

  getChannel(): amqplib.Channel {
    if (!this.channel) {
      throw new Error('RabbitMQClient: not connected — call connect() first');
    }
    return this.channel;
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.model?.close();
    this.channel = null;
    this.model = null;
  }
}
