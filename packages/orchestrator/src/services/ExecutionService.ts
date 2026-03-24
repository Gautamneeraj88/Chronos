import { v4 as uuidv4 } from 'uuid';
import {
  Execution,
  WorkflowDefinition,
  DomainEvent,
  StepResultMessage,
  StepExecuteMessage,
  NotFoundError,
  createLogger,
  LOCK_TTL_MS,
} from '@chronos/shared';
import { IExecutionRepository } from '../repositories/IExecutionRepository';
import { IEventRepository } from '../repositories/IEventRepository';
import { IWorkflowRepository } from '../repositories/IWorkflowRepository';
import { ILockService } from '../locks/ILockService';
import { SagaEngine } from '../domain/SagaEngine';
import { StepPublisher } from './StepPublisher';

const logger = createLogger('orchestrator');

export class ExecutionService {
  constructor(
    private readonly executionRepo: IExecutionRepository,
    private readonly eventRepo: IEventRepository,
    private readonly workflowRepo: IWorkflowRepository,
    private readonly lockService: ILockService,
    private readonly sagaEngine: SagaEngine,
    private readonly stepPublisher: StepPublisher,
  ) {}

  // ── Trigger a brand new execution ───────────────────────────────────────
  async triggerExecution(
    workflowId: string,
    input: Record<string, unknown>,
    userId: string,
  ): Promise<Execution> {
    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) throw new NotFoundError(`Workflow ${workflowId}`);

    const execution = await this.executionRepo.save({
      id: uuidv4(),
      workflowId,
      status: 'PENDING',
      currentStepIndex: 0,
      input,
      output: {},
      error: null,
      startedAt: new Date(),
      completedAt: null,
      createdBy: userId,
    });

    logger.info('Execution created', { executionId: execution.id, workflowId });

    return this.advanceExecution(execution, workflow, []);
  }

  // ── Called by ResultConsumer when a worker finishes a step ──────────────
  async handleStepResult(message: StepResultMessage): Promise<void> {
    const { executionId, stepId, success, output, error } = message;

    // Load current execution and workflow
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      logger.error('handleStepResult: execution not found', { executionId });
      return;
    }

    const workflow = await this.workflowRepo.findById(execution.workflowId);
    if (!workflow) {
      logger.error('handleStepResult: workflow not found', {
        workflowId: execution.workflowId,
      });
      return;
    }

    // Append the result event
    if (success) {
      await this.eventRepo.append(
        this.makeEvent(executionId, 'STEP_COMPLETED', output ?? {}, stepId),
      );
      logger.debug('Step completed', { executionId, stepId });
    } else {
      await this.eventRepo.append(this.makeEvent(executionId, 'STEP_FAILED', { error }, stepId));
      logger.warn('Step failed', { executionId, stepId, error });
    }

    // Advance the saga to the next action
    const events = await this.eventRepo.findByExecutionId(executionId);
    await this.advanceExecution(execution, workflow, events);
  }

  // ── Resume an in-flight execution (used by RecoveryEngine) ──────────────
  async resumeExecution(
    execution: Execution,
    workflow: WorkflowDefinition,
    existingEvents: DomainEvent[],
  ): Promise<Execution> {
    logger.info('Resuming execution', { executionId: execution.id });
    return this.advanceExecution(execution, workflow, existingEvents);
  }

  // ── Single-tick saga advance ─────────────────────────────────────────────
  // Determines the next action and either finalizes or publishes to Kafka.
  // Does NOT loop — each worker result triggers a new tick via handleStepResult.
  //
  // IMPORTANT: the lock is released BEFORE publish() is called. This ensures:
  //   1. handleStepResult() can re-acquire the lock when the result arrives.
  //   2. The loopback publisher used in tests can call back synchronously.
  private async advanceExecution(
    execution: Execution,
    workflow: WorkflowDefinition,
    existingEvents: DomainEvent[],
  ): Promise<Execution> {
    const { id: executionId } = execution;
    let publishMessage: StepExecuteMessage | null = null;

    await this.lockService.acquire(executionId, LOCK_TTL_MS);

    try {
      // Mark as RUNNING on first tick
      const hasStartedEvent = existingEvents.some((e) => e.type === 'EXECUTION_STARTED');
      if (!hasStartedEvent) {
        await this.executionRepo.updateStatus(executionId, 'RUNNING');
        await this.eventRepo.append(this.makeEvent(executionId, 'EXECUTION_STARTED'));
      }

      // Always work from the freshest event log
      const events = await this.eventRepo.findByExecutionId(executionId);
      const action = this.sagaEngine.determineNextAction(workflow, events);

      if (action.type === 'COMPLETE') {
        // Aggregate step outputs from STEP_COMPLETED event payloads
        const output: Record<string, unknown> = {};
        for (const e of events) {
          if (e.type === 'STEP_COMPLETED' && e.stepName) {
            output[e.stepName] = e.payload;
          }
        }
        await this.eventRepo.append(this.makeEvent(executionId, 'EXECUTION_COMPLETED'));
        await this.executionRepo.updateStatus(executionId, 'COMPLETED', {
          completedAt: new Date(),
          output,
        });
        logger.info('Execution completed', { executionId });
      } else if (action.type === 'FAIL') {
        await this.eventRepo.append(
          this.makeEvent(executionId, 'EXECUTION_FAILED', { reason: action.reason }),
        );
        await this.executionRepo.updateStatus(executionId, 'FAILED', {
          completedAt: new Date(),
          error: action.reason,
        });
        logger.warn('Execution failed', { executionId, reason: action.reason });
      } else if (action.type === 'EXECUTE_STEP') {
        const { step, stepIndex } = action;

        await this.executionRepo.updateStatus(executionId, 'RUNNING', {
          currentStepIndex: stepIndex,
        });
        await this.eventRepo.append(this.makeEvent(executionId, 'STEP_STARTED', {}, step.name));
        await this.eventRepo.append(this.makeEvent(executionId, 'STEP_IN_FLIGHT', {}, step.name));

        publishMessage = {
          executionId,
          workflowId: execution.workflowId,
          stepId: step.name,
          activityName: step.activity,
          input: execution.input,
          attemptNumber: 1,
        };
        logger.info('Step dispatched to worker', { executionId, step: step.name });
      } else if (action.type === 'RUN_COMPENSATION') {
        const { stepName, stepIndex } = action;

        await this.executionRepo.updateStatus(executionId, 'COMPENSATING', {
          currentStepIndex: stepIndex,
        });
        await this.eventRepo.append(
          this.makeEvent(executionId, 'COMPENSATION_STARTED', {}, stepName),
        );
        await this.eventRepo.append(this.makeEvent(executionId, 'STEP_IN_FLIGHT', {}, stepName));

        const compStep = workflow.steps.find((s) => s.name === stepName);
        if (compStep) {
          publishMessage = {
            executionId,
            workflowId: execution.workflowId,
            stepId: stepName,
            activityName: compStep.activity,
            input: execution.input,
            attemptNumber: 1,
          };
        }
        logger.info('Compensation dispatched to worker', { executionId, step: stepName });
      } else {
        throw new Error(`Unknown saga action: ${JSON.stringify(action)}`);
      }
    } finally {
      // Always release before publishing so handleStepResult can re-acquire
      await this.lockService.release(executionId);
    }

    if (publishMessage) {
      await this.stepPublisher.publish(publishMessage);
    }

    return (await this.executionRepo.findById(executionId))!;
  }

  // ── Public query methods ─────────────────────────────────────────────────
  async getExecution(id: string): Promise<Execution> {
    const execution = await this.executionRepo.findById(id);
    if (!execution) throw new NotFoundError(`Execution ${id}`);
    return execution;
  }

  async getExecutionEvents(executionId: string): Promise<DomainEvent[]> {
    return this.eventRepo.findByExecutionId(executionId);
  }

  // ── Helper: create a domain event ───────────────────────────────────────
  private makeEvent(
    executionId: string,
    type: DomainEvent['type'],
    payload: Record<string, unknown> = {},
    stepName: string | null = null,
  ): DomainEvent {
    return {
      id: uuidv4(),
      executionId,
      type,
      stepName,
      payload,
      occurredAt: new Date(),
    };
  }
}
