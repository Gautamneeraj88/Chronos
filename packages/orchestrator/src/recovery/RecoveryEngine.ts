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
    // Find every execution that was active when the server died
    // RUNNING = mid forward execution
    // COMPENSATING = mid rollback
    const [running, compensating] = await Promise.all([
      this.executionRepo.findByStatus('RUNNING'),
      this.executionRepo.findByStatus('COMPENSATING'),
    ]);

    const active = [...running, ...compensating];

    if (active.length === 0) {
      logger.info('Recovery: no in-flight executions found');
      return;
    }

    logger.info(`Recovery: found ${active.length} in-flight execution(s) — resuming`);

    for (const execution of active) {
      try {
        const events = await this.eventRepo.findByExecutionId(execution.id);
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

        // Check if the execution was mid-flight when it crashed
        // STEP_IN_FLIGHT with no following STEP_COMPLETED/STEP_FAILED means
        // the step was published to Kafka but result never arrived.
        // We re-publish it — workers are idempotent on executionId + stepId.
        const lastEvent = events[events.length - 1];
        const wasInFlight = lastEvent?.type === 'STEP_IN_FLIGHT';

        logger.info('Recovery: resuming execution', {
          executionId: execution.id,
          workflowId: execution.workflowId,
          status: execution.status,
          eventCount: events.length,
          lastEvent: lastEvent?.type ?? 'none',
          wasInFlight,
        });

        // Clear stale lock — safe at startup, no live process holds it
        await this.lockService.forceRelease(execution.id);

        // advanceExecution replays events through SagaEngine and re-publishes
        // the in-flight step to Kafka if needed
        await this.executionService.resumeExecution(execution, workflow, events);

        logger.info('Recovery: execution resumed successfully', {
          executionId: execution.id,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Recovery: failed to resume execution', {
          executionId: execution.id,
          error: message,
        });
        await this.executionRepo.updateStatus(execution.id, 'FAILED', {
          error: `Recovery failed: ${message}`,
          completedAt: new Date(),
        });
      }
    }

    logger.info('Recovery: complete');
  }
}
