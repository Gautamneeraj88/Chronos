import { NotificationConsumer, NotificationHandler } from '../NotificationConsumer';
import { ExecutionNotification } from '@chronos/shared';

const NOTIFICATION: ExecutionNotification = {
  executionId: 'exec-1',
  workflowId: 'wf-1',
  orgId: 'org-abc',
  status: 'COMPLETED',
  completedAt: '2026-03-24T00:00:00.000Z',
};

function makeChannel(overrides = {}) {
  return {
    assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue' }),
    bindQueue: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue(undefined),
    ack: jest.fn(),
    nack: jest.fn(),
    ...overrides,
  };
}

function makeClient(channel: ReturnType<typeof makeChannel>) {
  return { getChannel: jest.fn().mockReturnValue(channel) };
}

describe('NotificationConsumer', () => {
  it('asserts queue, binds to exchange, and starts consuming on start()', async () => {
    const channel = makeChannel();
    const client = makeClient(channel);

    const consumer = new NotificationConsumer(
      client as any,
      'test-queue',
      'execution.#',
      [],
    );
    await consumer.start();

    expect(channel.assertQueue).toHaveBeenCalledWith('test-queue', expect.any(Object));
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'test-queue',
      'chronos.execution.events',
      'execution.#',
    );
    expect(channel.consume).toHaveBeenCalled();
  });

  it('calls all handlers and acks on successful processing', async () => {
    const handler1: NotificationHandler = jest.fn();
    const handler2: NotificationHandler = jest.fn();

    let capturedOnMessage: ((msg: any) => void) | null = null;
    const channel = makeChannel({
      consume: jest.fn().mockImplementation((_queue: string, onMessage: (msg: any) => void) => {
        capturedOnMessage = onMessage;
        return Promise.resolve();
      }),
    });
    const client = makeClient(channel);

    const consumer = new NotificationConsumer(
      client as any,
      'test-queue',
      'execution.#',
      [handler1, handler2],
    );
    await consumer.start();

    const msg = { content: Buffer.from(JSON.stringify(NOTIFICATION)) };
    await capturedOnMessage!(msg);

    expect(handler1).toHaveBeenCalledWith(NOTIFICATION);
    expect(handler2).toHaveBeenCalledWith(NOTIFICATION);
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('nacks without requeue when a handler throws', async () => {
    const handler: NotificationHandler = jest.fn().mockRejectedValue(new Error('boom'));

    let capturedOnMessage: ((msg: any) => void) | null = null;
    const channel = makeChannel({
      consume: jest.fn().mockImplementation((_queue: string, onMessage: (msg: any) => void) => {
        capturedOnMessage = onMessage;
        return Promise.resolve();
      }),
    });
    const client = makeClient(channel);

    const consumer = new NotificationConsumer(client as any, 'test-queue', 'execution.#', [handler]);
    await consumer.start();

    const msg = { content: Buffer.from(JSON.stringify(NOTIFICATION)) };
    await capturedOnMessage!(msg);

    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('ignores null messages (consumer cancel notification)', async () => {
    let capturedOnMessage: ((msg: any) => void) | null = null;
    const channel = makeChannel({
      consume: jest.fn().mockImplementation((_queue: string, onMessage: (msg: any) => void) => {
        capturedOnMessage = onMessage;
        return Promise.resolve();
      }),
    });
    const client = makeClient(channel);

    const consumer = new NotificationConsumer(client as any, 'test-queue', 'execution.#', []);
    await consumer.start();

    await capturedOnMessage!(null);

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).not.toHaveBeenCalled();
  });
});
