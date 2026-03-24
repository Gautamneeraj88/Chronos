import { NotificationPublisher } from '../services/NotificationPublisher';
import { ExecutionNotification } from '@chronos/shared';

describe('NotificationPublisher', () => {
  const mockChannel = {
    publish: jest.fn().mockReturnValue(true),
  };

  const publisher = new NotificationPublisher(mockChannel as any);

  beforeEach(() => jest.clearAllMocks());

  it('publishes to the execution events exchange with correct routing key on COMPLETED', () => {
    const notification: ExecutionNotification = {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      orgId: 'org-abc',
      status: 'COMPLETED',
      output: { result: 42 },
      completedAt: '2026-03-24T00:00:00.000Z',
    };

    publisher.publish(notification);

    expect(mockChannel.publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, body] = mockChannel.publish.mock.calls[0];
    expect(exchange).toBe('chronos.execution.events');
    expect(routingKey).toBe('execution.completed.org-abc');
    const parsed = JSON.parse((body as Buffer).toString());
    expect(parsed.executionId).toBe('exec-1');
    expect(parsed.status).toBe('COMPLETED');
  });

  it('publishes with correct routing key on FAILED', () => {
    const notification: ExecutionNotification = {
      executionId: 'exec-2',
      workflowId: 'wf-1',
      orgId: 'org-abc',
      status: 'FAILED',
      error: 'step timed out',
      completedAt: '2026-03-24T00:00:00.000Z',
    };

    publisher.publish(notification);

    const [, routingKey] = mockChannel.publish.mock.calls[0];
    expect(routingKey).toBe('execution.failed.org-abc');
  });

  it('does not throw when channel.publish throws', () => {
    mockChannel.publish.mockImplementationOnce(() => {
      throw new Error('connection lost');
    });

    const notification: ExecutionNotification = {
      executionId: 'exec-3',
      workflowId: 'wf-1',
      orgId: 'org-abc',
      status: 'COMPLETED',
      completedAt: '2026-03-24T00:00:00.000Z',
    };

    expect(() => publisher.publish(notification)).not.toThrow();
  });
});
