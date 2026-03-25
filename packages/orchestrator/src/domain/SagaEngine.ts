import { WorkflowDefinition, WorkflowStep, DomainEvent } from '@chronos/shared';

// The only output the SagaEngine produces
// Caller reads this and decides how to execute it
export type SagaAction =
  | { type: 'EXECUTE_STEP'; stepIndex: number; step: WorkflowStep }
  | { type: 'RUN_COMPENSATION'; stepIndex: number; stepName: string }
  | { type: 'COMPLETE' }
  | { type: 'FAIL'; reason: string };

// Internal state derived from replaying events
// Private - only SagaEngine uses this
interface SagaState {
  completedSteps: Set<string>;
  failedStep: string | null;
  isCompensating: boolean;
  compensatedSteps: Set<string>;
  isCompleted: boolean;
  isFailed: boolean;
}

export class SagaEngine {
  // Pure function - same input always produce same output
  // No async, no sie effects, no database access
  determineNextAction(definition: WorkflowDefinition, events: DomainEvent[]): SagaAction {
    const state = this.replayEvents(events);

    // If already in a termineal state  return immediately (idemotent)
    if (state.isCompleted) return { type: 'COMPLETE' };
    if (state.isFailed) return { type: 'FAIL', reason: 'Execution already failed' };

    // A step failed - we are in compensation mode
    if (state.isCompensating) {
      return this.determineCompensationAction(definition, state);
    }

    // Normal forward execution
    return this.determineNextStep(definition, state);
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private replayEvents(events: DomainEvent[]): SagaState {
    const state: SagaState = {
      completedSteps: new Set(),
      failedStep: null,
      isCompensating: false,
      compensatedSteps: new Set(),
      isCompleted: false,
      isFailed: false,
    };

    // Events must be sorted ASC by occurredAt before replay
    // The repository guarantees this — but we sort here as a safety net
    const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    for (const event of sorted) {
      switch (event.type) {
        case 'STEP_COMPLETED':
          state.completedSteps.add(event.stepName!);
          break;

        case 'STEP_FAILED':
          state.failedStep = event.stepName!;
          state.isCompensating = true;
          break;

        case 'COMPENSATION_COMPLETED':
        case 'COMPENSATION_FAILED':
          // Both mark the compensation as done — FAILED means "tried and gave up",
          // still advance past it so we don't loop forever.
          state.compensatedSteps.add(event.stepName!);
          break;

        case 'EXECUTION_COMPLETED':
          state.isCompleted = true;
          break;

        case 'EXECUTION_FAILED':
          state.isFailed = true;
          break;

        // EXECUTION_STARTED, STEP_STARTED, COMPENSATION_STARTED
        // don't change the decision-making state
        default:
          break;
      }
    }

    return state;
  }

  private determineNextStep(definition: WorkflowDefinition, state: SagaState): SagaAction {
    // Find the first step that has not completed yet
    for (let i = 0; i < definition.steps.length; i++) {
      const step = definition.steps[i];
      if (!state.completedSteps.has(step.name)) {
        return { type: 'EXECUTE_STEP', stepIndex: i, step };
      }
    }

    // All steps completed
    return { type: 'COMPLETE' };
  }

  private determineCompensationAction(
    definition: WorkflowDefinition,
    state: SagaState,
  ): SagaAction {
    // Find steps that:
    // 1. Successfully completed (so they need to be undone)
    // 2. Have a compensation defined
    // 3. Haven't been compensated yet
    // Run them in REVERSE order — last completed step first
    const stepsToCompensate = definition.steps
      .filter(
        (step) =>
          state.completedSteps.has(step.name) &&
          step.compensation !== null &&
          !state.compensatedSteps.has(step.compensation),
      )
      .reverse(); // reverse = undo last thing first

    if (stepsToCompensate.length > 0) {
      const step = stepsToCompensate[0];
      return {
        type: 'RUN_COMPENSATION',
        stepIndex: definition.steps.indexOf(step),
        stepName: step.compensation!,
      };
    }

    // No more compensations to run — execution has failed
    return {
      type: 'FAIL',
      reason: `Step '${state.failedStep}' failed and all compensations have run`,
    };
  }
}
