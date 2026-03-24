import 'dotenv/config';

interface WorkerConfig {
  port: number;
  nodeEnv: string;
  kafkaBrokers: string[];
  workerId: string;
}

export function loadConfig(): WorkerConfig {
  return {
    port: parseInt(process.env.PORT ?? '3002', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    workerId: process.env.WORKER_ID ?? `worker-${process.pid}`,
  };
}
