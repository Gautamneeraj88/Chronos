import type { Response } from 'express';
import type { ExecutionNotification } from '@chronos/shared';
import { createLogger } from '@chronos/shared';

const logger = createLogger('notifier:sse');

// Each SSE client is just an Express Response that we keep writing to.
const clients = new Set<Response>();

export function addSseClient(res: Response): void {
  clients.add(res);
  logger.info('SSE client connected', { total: clients.size });
}

export function removeSseClient(res: Response): void {
  clients.delete(res);
  logger.info('SSE client disconnected', { total: clients.size });
}

/**
 * Broadcasts a notification to all connected dashboard clients.
 * Maps ExecutionNotification → LiveNotification shape expected by the dashboard.
 */
export function broadcastNotification(notification: ExecutionNotification): void {
  if (clients.size === 0) return;

  const payload = JSON.stringify({
    id: `${notification.executionId}-${Date.now()}`,
    executionId: notification.executionId,
    workflowId: notification.workflowId,
    status: notification.status,
    orgId: notification.orgId,
    occurredAt: notification.completedAt,
  });

  const chunk = `event: notification\ndata: ${payload}\n\n`;

  for (const client of clients) {
    try {
      client.write(chunk);
    } catch {
      clients.delete(client);
    }
  }

  logger.info('SSE broadcast', { executionId: notification.executionId, clients: clients.size });
}
