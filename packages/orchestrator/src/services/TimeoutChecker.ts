import { createLogger } from '@chronos/shared';
import { ITimeoutStore } from '../timeouts';
import { ExecutionService } from './ExecutionService';

const logger = createLogger('orchestrator');

export class TimeoutChecker {
  private timer: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 1000;

  constructor(
    private readonly timeoutStore: ITimeoutStore,
    private readonly executionService: ExecutionService,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.check().catch((err) =>
        logger.error('TimeoutChecker poll error', { err }),
      );
    }, this.POLL_INTERVAL_MS);
    logger.info('TimeoutChecker started', { pollIntervalMs: this.POLL_INTERVAL_MS });
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async check(): Promise<void> {
    const expired = await this.timeoutStore.consumeExpired();
    for (const { executionId, stepId } of expired) {
      logger.warn('Step timed out — injecting failure', { executionId, stepId });
      await this.executionService.handleStepResult({
        executionId,
        stepId,
        success: false,
        output: {},
        error: `Step '${stepId}' timed out`,
      });
    }
  }
}
