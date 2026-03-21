import { createLogger } from '@chronos/shared';
import { shouldFail, sleep } from './mockUtils';

const logger = createLogger('orchestrator');

export async function sendConfirmation(
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  await sleep(50);

  if (shouldFail('send-confirmation')) {
    throw new Error('Email service timeout');
  }

  logger.debug('sendConfirmation executed', { orderId: input.orderId });
  return { emailId: `email_${Date.now()}` };
}
