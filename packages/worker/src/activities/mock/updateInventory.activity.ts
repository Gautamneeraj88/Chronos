import { createLogger } from '@chronos/shared';
import { shouldFail, mockDelay, sleep } from './mockUtils';

const logger = createLogger('orchestrator');

export async function updateInventory(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  await mockDelay(5000);

  const attempt = (input._attempt as number | undefined) ?? 1;
  if (shouldFail('update-inventory', attempt)) {
    throw new Error('Inventory service unavailable');
  }

  logger.debug('updateInventory executed', { orderId: input.orderId });
  return { reservationId: `res_${Date.now()}` };
}

export async function restoreInventory(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  await sleep(80);
  logger.debug('restoreInventory executed (compensation)', { orderId: input.orderId });
  return { restoredAt: new Date().toISOString() };
}
