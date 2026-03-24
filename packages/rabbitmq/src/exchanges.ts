// Topic exchange for execution lifecycle notifications.
// Routing key pattern: execution.<status>.<orgId>
// e.g. execution.completed.org-abc, execution.failed.org-abc
export const EXECUTION_EVENTS_EXCHANGE = 'chronos.execution.events';

export const EXCHANGE_TYPE = 'topic' as const;

export function routingKey(status: 'completed' | 'failed', orgId: string): string {
  return `execution.${status}.${orgId}`;
}
