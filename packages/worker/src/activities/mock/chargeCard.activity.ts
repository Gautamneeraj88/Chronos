import { createLogger } from '@chronos/shared';
import { shouldFail, mockDelay, sleep } from './mockUtils';

const logger = createLogger('orchestrator');

export async function chargeCard(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  await mockDelay(150);

  if (shouldFail('charge-card')) {
    throw new Error('Card declined - insufficient funds');
  }

  logger.debug('charge executed', { orderId: input.orderId });
  return {
    transactionId: `txn_${Date.now()}`,
    amount: input.amount,
  };
}

export async function refundCard(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  await sleep(100);
  logger.debug('refundCard executed (compensation)', { orderId: input.orderId });
  return {
    refundId: `ref_${Date.now()}`,
  };
}
