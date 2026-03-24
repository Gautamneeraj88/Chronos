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
import { ITimeoutStore } from '../timeouts';
import {
  executionStarted,
  executionCompleted,
  activeExecutions,
} from '../metrics/metrics';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const logger = createLogger('orchestrator');
const tracer = trace.getTracer('chronos-orchestrator');

export class ExecutionService {
  constructor(
    private readonly executionRepo: IExecutionRepository,
    private readonly eventRepo: IEventRepository,
    private readonly workflowRepo: IWorkflowRepository,
    private readonly lockService: ILockService,
    private readonly sagaEngine: SagaEngine,
    private readonly stepPublisher: StepPublisher,
    private readonly timeoutStore: ITimeoutStore,
  ) {}

  // ── Trigger a brand new execution ───────────────────────────────────────
  async triggerExecution(
    workflowId: string,
    input: Record<string, unknown>,
    userId: string,
    orgId: string,
  ): Promise<Execution> {
    const workflow = await this.workflowRepo.findById(workflowId, orgId);
    if (!workflow) throw new NotFoundError(`Workflow ${workflowId}`);

    const execution = await this.executionRepo.save({
      id: uuidv4(),
      orgId,
      workflowId,
      workflowVersion: workflow.version,
      status: 'PENDING',
      currentStepIndex: 0,
      input,
      output: {},
      error: null,
      startedAt: new Date(),
      completedAt: null,
      createdBy: userId,
    });

    executionStarted.inc();
    activeExecutions.inc();
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

    const workflow = await this.workflowRepo.findByIdAndVersion(
      execution.workflowId,
      execution.workflowVersion,
      execution.orgId,
    );
    if (!workflow) {
      logger.error('handleStepResult: workflow not found', {
        workflowId: execution.workflowId,
        workflowVersion: execution.workflowVersion,
        orgId: execution.orgId,
      });
      return;
    }

    // Idempotency guard: if this step already has a terminal event, a duplicate
    // result arrived (crash recovery re-publish) — drop it silently.
    const existingEvents = await this.eventRepo.findByExecutionId(executionId);
    const alreadyTerminal = existingEvents.some(
      (e) =>
        (e.type === 'STEP_COMPLETED' ||
          e.type === 'STEP_FAILED' ||
          e.type === 'COMPENSATION_COMPLETED') &&
        e.stepName === stepId,
    );
    if (alreadyTerminal) {
      logger.warn('handleStepResult: duplicate result ignored — step already terminal', {
        executionId,
        stepId,
      });
      return;
    }

    // Step has reached a terminal state — cancel its pending timeout
    await this.timeoutStore.cancel(executionId, stepId);

    // Append the result event.
    // Compensation steps complete with COMPENSATION_COMPLETED so the SagaEngine
    // can track which compensations have run (it ignores STEP_COMPLETED in that path).
    const isCompensating = execution.status === 'COMPENSATING';
    if (success) {
      const eventType = isCompensating ? 'COMPENSATION_COMPLETED' : 'STEP_COMPLETED';
      await this.eventRepo.append(this.makeEvent(executionId, eventType, output ?? {}, stepId));
      logger.debug(isCompensating ? 'Compensation completed' : 'Step completed', {
        executionId,
        stepId,
      });
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
    let timeoutSchedule: { stepId: string; expiresAt: number } | null = null;

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
        executionCompleted.inc({ status: 'COMPLETED' });
        activeExecutions.dec();
        logger.info('Execution completed', { executionId });
      } else if (action.type === 'FAIL') {
        await this.eventRepo.append(
          this.makeEvent(executionId, 'EXECUTION_FAILED', { reason: action.reason }),
        );
        await this.executionRepo.updateStatus(executionId, 'FAILED', {
          completedAt: new Date(),
          error: action.reason,
        });
        executionCompleted.inc({ status: 'FAILED' });
        activeExecutions.dec();
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
          retries: step.retries,
          timeoutMs: step.timeoutMs,
        };
        // Cancel any stale timeout (e.g. from a previous crash), then schedule fresh
        timeoutSchedule = { stepId: step.name, expiresAt: Date.now() + step.timeoutMs };
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

        // Find the parent step to inherit retries/timeoutMs; fall back to safe defaults
        const parentStep = workflow.steps.find((s) => s.compensation === stepName);
        const retries = parentStep?.retries ?? 0;
        const timeoutMs = parentStep?.timeoutMs ?? 30_000;

        // Compensation steps (e.g. 'refund-card') are not in workflow.steps — they are
        // referenced only as strings in step.compensation. The ActivityRunner registry
        // is keyed by step name, so stepName doubles as the activityName here.
        publishMessage = {
          executionId,
          workflowId: execution.workflowId,
          stepId: stepName,
          activityName: stepName,
          input: execution.input,
          attemptNumber: 1,
          retries,
          timeoutMs,
        };
        timeoutSchedule = { stepId: stepName, expiresAt: Date.now() + timeoutMs };
        logger.info('Compensation dispatched to worker', { executionId, step: stepName });
      } else {
        throw new Error(`Unknown saga action: ${JSON.stringify(action)}`);
      }
    } finally {
      // Always release before publishing so handleStepResult can re-acquire
      await this.lockService.release(executionId);
    }

    if (timeoutSchedule) {
      // Cancel first to overwrite any stale entry from a previous crash
      await this.timeoutStore.cancel(executionId, timeoutSchedule.stepId);
      await this.timeoutStore.schedule(executionId, timeoutSchedule.stepId, timeoutSchedule.expiresAt);
    }

    if (publishMessage) {
      const span = tracer.startSpan('step.dispatch', {
        attributes: {
          'execution.id': publishMessage.executionId,
          'step.id': publishMessage.stepId,
          'activity.name': publishMessage.activityName,
          'attempt.number': publishMessage.attemptNumber,
        },
      });
      try {
        const traceId = span.spanContext().traceId;
        await this.stepPublisher.publish({ ...publishMessage, traceId });
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    }

    return (await this.executionRepo.findById(executionId))!;
  }

  // ── Public query methods ─────────────────────────────────────────────────
  async getExecution(id: string, orgId?: string): Promise<Execution> {
    const execution = await this.executionRepo.findById(id, orgId);
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
