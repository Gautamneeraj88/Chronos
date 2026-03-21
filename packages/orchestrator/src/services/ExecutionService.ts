import { v4 as uuidv4 } from 'uuid';
import {
  Execution,
  WorkflowDefinition,
  DomainEvent,
  NotFoundError,
  createLogger,
  LOCK_TTL_MS,
} from '@chronos/shared';
import { IExecutionRepository } from '../repositories/IExecutionRepository';
import { IEventRepository }     from '../repositories/IEventRepository';
import { IWorkflowRepository }  from '../repositories/IWorkflowRepository';
import { ILockService }         from '../locks/ILockService';
import { SagaEngine }           from '../domain/SagaEngine';
import { ActivityRunner }       from '../activities/ActivityRunner';

const logger = createLogger('orchestrator');

export class ExecutionService {
  constructor(
    private readonly executionRepo: IExecutionRepository,
    private readonly eventRepo:     IEventRepository,
    private readonly workflowRepo:  IWorkflowRepository,
    private readonly lockService:   ILockService,
    private readonly sagaEngine:    SagaEngine,
    private readonly activityRunner: ActivityRunner
  ) {}

  // ── Trigger a brand new execution ───────────────────────────────────────

  async triggerExecution(
    workflowId: string,
    input: Record<string, unknown>,
    userId: string
  ): Promise<Execution> {
    // 1. Load the workflow definition
    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) throw new NotFoundError(`Workflow ${workflowId}`);

    // 2. Create the execution record in PENDING state
    const execution = await this.executionRepo.save({
      id:               uuidv4(),
      workflowId,
      status:           'PENDING',
      currentStepIndex: 0,
      input,
      output:           {},
      error:            null,
      startedAt:        new Date(),
      completedAt:      null,
      createdBy:        userId,
    });

    logger.info('Execution created', { executionId: execution.id, workflowId });

    // 3. Run the execution and return the final result
    return this.runExecution(execution, workflow, []);
  }

  // ── Resume an in-flight execution (used by RecoveryEngine) ─────────────

  async resumeExecution(
    execution: Execution,
    workflow: WorkflowDefinition,
    existingEvents: DomainEvent[]
  ): Promise<Execution> {
    logger.info('Resuming execution', { executionId: execution.id });
    return this.runExecution(execution, workflow, existingEvents);
  }

  // ── The core execution loop ─────────────────────────────────────────────

  private async runExecution(
    execution: Execution,
    workflow: WorkflowDefinition,
    existingEvents: DomainEvent[]
  ): Promise<Execution> {
    const { id: executionId } = execution;

    // Acquire distributed lock — only one process can run this execution
    await this.lockService.acquire(executionId, LOCK_TTL_MS);

    try {
      // Mark as RUNNING
      await this.executionRepo.updateStatus(executionId, 'RUNNING');

      // Append the started event (if not already there from a previous run)
      const hasStartedEvent = existingEvents.some(e => e.type === 'EXECUTION_STARTED');
      if (!hasStartedEvent) {
        await this.eventRepo.append(this.makeEvent(executionId, 'EXECUTION_STARTED'));
      }

      // Load all events — existing ones plus the one we just appended
      let events = await this.eventRepo.findByExecutionId(executionId);
      const output: Record<string, unknown> = {};

      // The saga loop — runs until COMPLETE or FAIL
      while (true) {
        const action = this.sagaEngine.determineNextAction(workflow, events);

        if (action.type === 'COMPLETE') {
          await this.eventRepo.append(
            this.makeEvent(executionId, 'EXECUTION_COMPLETED')
          );
          await this.executionRepo.updateStatus(executionId, 'COMPLETED', {
            completedAt: new Date(),
            output,
          });
          logger.info('Execution completed', { executionId });
          return (await this.executionRepo.findById(executionId))!;
        }

        if (action.type === 'FAIL') {
          await this.eventRepo.append(
            this.makeEvent(executionId, 'EXECUTION_FAILED', {
              reason: action.reason,
            })
          );
          await this.executionRepo.updateStatus(executionId, 'FAILED', {
            completedAt: new Date(),
            error: action.reason,
          });
          logger.warn('Execution failed', { executionId, reason: action.reason });
          return (await this.executionRepo.findById(executionId))!;
        }

        if (action.type === 'EXECUTE_STEP') {
          const { step, stepIndex } = action;

          await this.eventRepo.append(
            this.makeEvent(executionId, 'STEP_STARTED', {}, step.name)
          );
          await this.executionRepo.updateStatus(executionId, 'RUNNING', {
            currentStepIndex: stepIndex,
          });

          try {
            const result = await this.activityRunner.execute(
              step,
              execution.input
            );

            output[step.name] = result;

            await this.eventRepo.append(
              this.makeEvent(executionId, 'STEP_COMPLETED', result, step.name)
            );

            logger.debug('Step completed', { executionId, step: step.name });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);

            await this.eventRepo.append(
              this.makeEvent(executionId, 'STEP_FAILED', { error: message }, step.name)
            );

            logger.warn('Step failed', { executionId, step: step.name, error: message });
          }

          // Reload events after each step so saga engine sees the latest state
          events = await this.eventRepo.findByExecutionId(executionId);
          continue;
        }

        if (action.type === 'RUN_COMPENSATION') {
          const { stepName, stepIndex } = action;

          await this.eventRepo.append(
            this.makeEvent(executionId, 'COMPENSATION_STARTED', {}, stepName)
          );
          await this.executionRepo.updateStatus(executionId, 'COMPENSATING', {
            currentStepIndex: stepIndex,
          });

          try {
            // Find the compensation step definition by name
            const compStep = workflow.steps.find(s => s.name === stepName);
            if (compStep) {
              await this.activityRunner.execute(compStep, execution.input);
            }

            await this.eventRepo.append(
              this.makeEvent(executionId, 'COMPENSATION_COMPLETED', {}, stepName)
            );

            logger.debug('Compensation completed', { executionId, step: stepName });
          } catch (err) {
            // Compensation failed — log it but continue trying other compensations
            // We don't want a failed compensation to block other rollbacks
            const message = err instanceof Error ? err.message : String(err);
            logger.error('Compensation failed', {
              executionId,
              step: stepName,
              error: message,
            });

            // Still mark it as completed so saga engine moves on
            await this.eventRepo.append(
              this.makeEvent(executionId, 'COMPENSATION_COMPLETED', {
                error: message,
                failed: true,
              }, stepName)
            );
          }

          events = await this.eventRepo.findByExecutionId(executionId);
          continue;
        }
      }
    } finally {
      // Always release the lock — even if an exception was thrown
      // The finally block guarantees this runs no matter what
      await this.lockService.release(executionId);
    }
  }

  // ── Public query methods ────────────────────────────────────────────────

  async getExecution(id: string): Promise<Execution> {
    const execution = await this.executionRepo.findById(id);
    if (!execution) throw new NotFoundError(`Execution ${id}`);
    return execution;
  }

  async getExecutionEvents(executionId: string): Promise<DomainEvent[]> {
    return this.eventRepo.findByExecutionId(executionId);
  }

  // ── Helper: create a domain event ──────────────────────────────────────

  private makeEvent(
    executionId: string,
    type: DomainEvent['type'],
    payload: Record<string, unknown> = {},
    stepName: string | null = null
  ): DomainEvent {
    return {
      id:          uuidv4(),
      executionId,
      type,
      stepName,
      payload,
      occurredAt:  new Date(),
    };
  }
}
