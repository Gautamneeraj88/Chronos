import { createLogger } from '@chronos/shared';
import { shouldFail, sleep } from './mockUtils';

const logger = createLogger('orchestrator');

export async function updateInventory(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  await sleep(5000);

  if (shouldFail('update-inventory')) {
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
