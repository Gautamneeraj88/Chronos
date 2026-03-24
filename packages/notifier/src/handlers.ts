import { ExecutionNotification } from '@chronos/shared';
import { createLogger } from '@chronos/shared';

const logger = createLogger('notifier');

/**
 * Demo handler — logs every notification.
 * In production this would dispatch webhooks, send emails, etc.
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
 * Demo handler — simulates a webhook delivery.
 * Replace with a real HTTP POST to an org-registered endpoint.
 */
export function webhookHandler(notification: ExecutionNotification): void {
  logger.info('Webhook dispatched (demo)', {
    executionId: notification.executionId,
    status: notification.status,
    orgId: notification.orgId,
  });
}
