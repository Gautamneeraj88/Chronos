import { WorkflowStep, ActivityError } from '@chronos/shared';
import {
  chargeCard,
  refundCard,
} from './mock/chargeCard.activity';
import {
  updateInventory,
  restoreInventory,
} from './mock/updateInventory.activity';
import { sendConfirmation } from './mock/sendConfirmation.activity';

// The type of a registered activity function
type ActivityFn = (input: Record<string, unknown>) => Promise<Record<string, unknown>>;

export class ActivityRunner {
  // Registry maps step name → function
  // Adding a new activity = add one line here
  // Open/Closed principle — extend without modifying the runner
  private readonly registry = new Map<string, ActivityFn>([
    ['charge-card',        chargeCard],
    ['refund-card',        refundCard],
    ['update-inventory',   updateInventory],
    ['restore-inventory',  restoreInventory],
    ['send-confirmation',  sendConfirmation],
  ]);

  async execute(
    step: WorkflowStep,
    input: Record<string, unknown>,
    attempt = 1
  ): Promise<Record<string, unknown>> {
    const activity = this.registry.get(step.name);

    if (!activity) {
      throw new ActivityError(
        step.name,
        attempt,
        `No activity registered for step '${step.name}'`
      );
    }

    try {
      return await this.withTimeout(
        activity(input),
        step.timeoutMs,
        step.name
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ActivityError(step.name, attempt, message);
    }
  }

  // Wraps a promise with a timeout
  // If the activity takes longer than timeoutMs, it fails with a clear error
  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    stepName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Step '${stepName}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(result => { clearTimeout(timer); resolve(result); })
        .catch(err  => { clearTimeout(timer); reject(err); });
    });
  }
}
