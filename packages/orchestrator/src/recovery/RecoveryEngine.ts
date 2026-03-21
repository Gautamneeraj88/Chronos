import { createLogger } from '@chronos/shared';
import { IEventRepository, IExecutionRepository, IWorkflowRepository } from '../repositories';
import { ILockService } from '../locks';
import { ExecutionService } from '../services';

const logger = createLogger('orchestrator');

export class RecoveryEngine {
  constructor(
    private readonly executionRepo: IExecutionRepository,
    private readonly eventRepo: IEventRepository,
    private readonly workflowRepo: IWorkflowRepository,
    private readonly executionService: ExecutionService,
    private readonly lockService: ILockService,
  ) {}

  async recoverInFlightExecutions(): Promise<void> {
    //Find every execution that was RUNNING when the server died
    const running = await this.executionRepo.findByStatus('RUNNING');

    if (running.length === 0) {
      logger.info('Recovery: no in-flight executions found');
      return;
    }

    logger.info(`Recovery: found ${running.length} in-flight execution(s) - resuming`);

    for (const execution of running) {
      try {
        // Load the full event log for this execution
        const events = await this.eventRepo.findByExecutionId(execution.id);

        //Load the workflow definition
        const workflow = await this.workflowRepo.findById(execution.workflowId);
        if (!workflow) {
          logger.error('Recovery: workflow not found for execution', {
            executionId: execution.id,
            workflowId: execution.workflowId,
          });

          await this.executionRepo.updateStatus(execution.id, 'FAILED', {
            error: 'Workflow definition not found during recovery',
            completedAt: new Date(),
          });
          continue;
        }

        logger.info('Recovery: resuming execution', {
          executionId: execution.id,
          workflowId: execution.workflowId,
          eventCount: events.length,
          lastEvent: events[events.length - 1]?.type ?? 'none',
        });

        // Clear any stale lock left by the crashed process before resuming.
        // Safe here because we're on startup — no live process can hold this lock.
        await this.lockService.forceRelease(execution.id);

        // Hand off to ExecutionService - it replays events through SagaEngine
        // and continues from the next incomplete step
        await this.executionService.resumeExecution(execution, workflow, events);

        logger.info('Recovery: execution resumed successfully', {
          executionId: execution.id,
        });
      } catch (err) {
        // One failed recovery should not stop others from recovering
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Recovery: failed to resume execution', {
          executionId: execution.id,
          error: message,
        });

        // Mark it failed so it doesn't get stuck in RUNNING forever
        await this.executionRepo.updateStatus(execution.id, 'FAILED', {
          error: `Recovery failed: ${message}`,
          completedAt: new Date(),
        });
      }
    }
    logger.info('Recovery: complete');
  }
}
