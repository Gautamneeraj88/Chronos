import axios from 'axios';
import { ExecutionNotification } from '@chronos/shared';
import { createLogger } from '@chronos/shared';
import { broadcastNotification } from './sse';

const logger = createLogger('notifier');

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? 'http://localhost:3001';

/**
 * Logs every notification for audit purposes.
 */
export function auditLogHandler(notification: ExecutionNotification): void {
  logger.info('Execution notification received', {
    executionId: notification.executionId,
    workflowId: notification.workflowId,
    orgId: notification.orgId,
    status: notification.status,
    completedAt: notification.completedAt,
  });
}

/**
 * Broadcasts the notification to connected dashboard SSE clients,
 * then fetches registered webhooks for the org and HTTP-POSTs to each.
 */
export async function webhookHandler(notification: ExecutionNotification): Promise<void> {
  // 1. Push to all connected dashboard clients immediately
  broadcastNotification(notification);

  // 2. Fetch active webhooks for this org and dispatch HTTP POST to each
  let webhooks: Array<{ id: string; url: string; events: string[]; secret: string | null }> = [];
  try {
    const { data } = await axios.get<typeof webhooks>(
      `${ORCHESTRATOR_URL}/internal/webhooks/active`,
      { headers: { 'X-Org-Id': notification.orgId }, timeout: 5000 },
    );
    webhooks = data;
  } catch (err) {
    logger.warn('Could not fetch webhooks for org', { orgId: notification.orgId, err });
    return;
  }

  const payload = {
    event: `execution.${notification.status.toLowerCase()}`,
    executionId: notification.executionId,
    workflowId: notification.workflowId,
    orgId: notification.orgId,
    status: notification.status,
    completedAt: notification.completedAt,
  };

  const relevant = webhooks.filter(
    (w) => w.events.includes('*') || w.events.includes(payload.event),
  );

  for (const webhook of relevant) {
    try {
      await axios.post(webhook.url, payload, {
        timeout: 10_000,
        headers: {
          'Content-Type': 'application/json',
          ...(webhook.secret ? { 'X-Chronos-Secret': webhook.secret } : {}),
        },
      });
      logger.info('Webhook delivered', { webhookId: webhook.id, url: webhook.url });
    } catch (err) {
      logger.warn('Webhook delivery failed', { webhookId: webhook.id, url: webhook.url, err });
    }
  }
}
