import { Kafka, Producer, Consumer, KafkaConfig } from 'kafkajs';
import { createLogger, ILogger } from '@chronos/shared';

export class KafkaClient {
  private static instance: KafkaClient;
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumers: Map<string, Consumer> = new Map();
  private logger: ILogger = createLogger('kafka');

  private constructor(config: KafkaConfig) {
    this.kafka = new Kafka(config);
  }

  static getInstance(config?: KafkaConfig): KafkaClient {
    if (!KafkaClient.instance) {
      if (!config) throw new Error('KafkaClient config require on first init');
      KafkaClient.instance = new KafkaClient(config);
    }
    return KafkaClient.instance;
  }

  async getProducer(): Promise<Producer> {
    if (!this.producer) {
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: false,
        idempotent: true,
      });
      await this.producer.connect();
      this.logger.info('Kafka producer connected');
    }
    return this.producer;
  }

  async getConsumer(groupId: string): Promise<Consumer> {
    if (!this.consumers.has(groupId)) {
      const consumer = this.kafka.consumer({
        groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
      });
      await consumer.connect();
      this.consumers.set(groupId, consumer);
      this.logger.info('Kafka consumer connected', { groupId });
    }
    return this.consumers.get(groupId)!;
  }

  async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
      this.logger.info('Kafka producer disconnected');
    }
    for (const [groupId, consumer] of this.consumers) {
      await consumer.disconnect();
      this.logger.info('Kafka consumer disconnected', { groupId });
    }
    this.consumers.clear();
  }
}
