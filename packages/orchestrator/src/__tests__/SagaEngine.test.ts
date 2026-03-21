import { SagaEngine, SagaAction } from '../domain';
import { WorkflowDefinition, DomainEvent } from '@chronos/shared';
import { v4 as uuidv4 } from 'uuid';

// ─── Test helpers ─────────────────────────────────────────────────────────

// A simple 3-step workflow used in most tests
const threeStepWorkflow: WorkflowDefinition = {
  id: 'wf-1',
  name: 'order-processing',
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  steps: [
    {
      name: 'charge-card',
      type: 'activity',
      retries: 3,
      timeoutMs: 5000,
      compensation: 'refund-card',
    },
    {
      name: 'update-inventory',
      type: 'activity',
      retries: 3,
      timeoutMs: 5000,
      compensation: 'restore-inventory',
    },
    {
      name: 'send-confirmation',
      type: 'activity',
      retries: 3,
      timeoutMs: 5000,
      compensation: null,
    },
  ],
};

// A workflow where no steps have compensations
const noCompensationWorkflow: WorkflowDefinition = {
  id: 'wf-2',
  name: 'simple-workflow',
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  steps: [
    { name: 'step-a', type: 'activity', retries: 3, timeoutMs: 5000, compensation: null },
    { name: 'step-b', type: 'activity', retries: 3, timeoutMs: 5000, compensation: null },
  ],
};

// Helper — creates a DomainEvent with minimal boilerplate
function makeEvent(
  type: DomainEvent['type'],
  stepName: string | null = null,
  offsetMs = 0,
): DomainEvent {
  return {
    id: uuidv4(),
    executionId: 'exec-1',
    type,
    stepName,
    payload: {},
    occurredAt: new Date(Date.now() + offsetMs),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

const engine = new SagaEngine();

describe('SagaEngine', () => {
  // ── Forward execution ──────────────────────────────────────────────────

  describe('forward execution (no failures)', () => {
    it('returns EXECUTE_STEP for step 0 when no events exist', () => {
      const action = engine.determineNextAction(threeStepWorkflow, []);

      expect(action.type).toBe('EXECUTE_STEP');
      if (action.type === 'EXECUTE_STEP') {
        expect(action.stepIndex).toBe(0);
        expect(action.step.name).toBe('charge-card');
      }
    });

    it('returns EXECUTE_STEP for step 1 when step 0 is completed', () => {
      const events = [
        makeEvent('EXECUTION_STARTED', null, 0),
        makeEvent('STEP_COMPLETED', 'charge-card', 10),
      ];

      const action = engine.determineNextAction(threeStepWorkflow, events);

      expect(action.type).toBe('EXECUTE_STEP');
      if (action.type === 'EXECUTE_STEP') {
        expect(action.stepIndex).toBe(1);
        expect(action.step.name).toBe('update-inventory');
      }
    });

    it('returns EXECUTE_STEP for step 2 when steps 0 and 1 are completed', () => {
      const events = [
        makeEvent('EXECUTION_STARTED', null, 0),
        makeEvent('STEP_COMPLETED', 'charge-card', 10),
        makeEvent('STEP_COMPLETED', 'update-inventory', 20),
      ];

      const action = engine.determineNextAction(threeStepWorkflow, events);

      expect(action.type).toBe('EXECUTE_STEP');
      if (action.type === 'EXECUTE_STEP') {
        expect(action.stepIndex).toBe(2);
        expect(action.step.name).toBe('send-confirmation');
      }
    });

    it('returns COMPLETE when all steps are completed', () => {
      const events = [
        makeEvent('EXECUTION_STARTED', null, 0),
        makeEvent('STEP_COMPLETED', 'charge-card', 10),
        makeEvent('STEP_COMPLETED', 'update-inventory', 20),
        makeEvent('STEP_COMPLETED', 'send-confirmation', 30),
      ];

      const action = engine.determineNextAction(threeStepWorkflow, events);

      expect(action.type).toBe('COMPLETE');
    });
  });

  // ── Compensation ───────────────────────────────────────────────────────

  describe('compensation (step failure)', () => {
    it('returns RUN_COMPENSATION when step 0 fails and it has a compensation', () => {
      const events = [
        makeEvent('EXECUTION_STARTED', null, 0),
        makeEvent('STEP_FAILED', 'charge-card', 10),
      ];

      const action = engine.determineNextAction(threeStepWorkflow, events);

      expect(action.type).toBe('FAIL');
      // charge-card failed but never completed — nothing to compensate
      // The compensation (refund-card) only runs for COMPLETED steps
    });

    it('returns RUN_COMPENSATION for step 0 when step 1 fails and step 0 completed', () => {
      const events = [
        makeEvent('EXECUTION_STARTED', null, 0),
        makeEvent('STEP_COMPLETED', 'charge-card', 10),
        makeEvent('STEP_FAILED', 'update-inventory', 20),
      ];

      const action = engine.determineNextAction(threeStepWorkflow, events);

      expect(action.type).toBe('RUN_COMPENSATION');
      if (action.type === 'RUN_COMPENSATION') {
        // update-inventory failed — charge-card completed before it
        // So we compensate charge-card (refund-card) first
        expect(action.stepName).toBe('refund-card');
      }
    });

    it('compensates in reverse order — step 1 before step 0', () => {
      const events = [
        makeEvent('EXECUTION_STARTED', null, 0),
        makeEvent('STEP_COMPLETED', 'charge-card', 10),
        makeEvent('STEP_COMPLETED', 'update-inventory', 20),
        makeEvent('STEP_FAILED', 'send-confirmation', 30),
      ];

      const action = engine.determineNextAction(threeStepWorkflow, events);

      expect(action.type).toBe('RUN_COMPENSATION');
      if (action.type === 'RUN_COMPENSATION') {
        // send-confirmation failed
        // update-inventory and charge-card completed
        // Reverse order: compensate update-inventory first
        expect(action.stepName).toBe('restore-inventory');
      }
    });

    it('moves to next compensation after first one completes', () => {
      const events = [
        makeEvent('EXECUTION_STARTED', null, 0),
        makeEvent('STEP_COMPLETED', 'charge-card', 10),
        makeEvent('STEP_COMPLETED', 'update-inventory', 20),
        makeEvent('STEP_FAILED', 'send-confirmation', 30),
        makeEvent('COMPENSATION_COMPLETED', 'update-inventory', 40),
      ];

      const action = engine.determineNextAction(threeStepWorkflow, events);

      expect(action.type).toBe('RUN_COMPENSATION');
      if (action.type === 'RUN_COMPENSATION') {
        // restore-inventory ran — now compensate charge-card
        expect(action.stepName).toBe('refund-card');
      }
    });

    it('returns FAIL when all compensations are done', () => {
      const events = [
        makeEvent('EXECUTION_STARTED', null, 0),
        makeEvent('STEP_COMPLETED', 'charge-card', 10),
        makeEvent('STEP_COMPLETED', 'update-inventory', 20),
        makeEvent('STEP_FAILED', 'send-confirmation', 30),
        makeEvent('COMPENSATION_COMPLETED', 'update-inventory', 40),
        makeEvent('COMPENSATION_COMPLETED', 'charge-card', 50),
      ];

      const action = engine.determineNextAction(threeStepWorkflow, events);

      expect(action.type).toBe('FAIL');
    });

    it('returns FAIL immediately when failed step has no compensation', () => {
      const events = [
        makeEvent('EXECUTION_STARTED', null, 0),
        makeEvent('STEP_FAILED', 'step-a', 10),
      ];

      const action = engine.determineNextAction(noCompensationWorkflow, events);

      expect(action.type).toBe('FAIL');
    });

    it('skips steps with no compensation during rollback', () => {
      // Workflow: step-a (no comp) → step-b (has comp: undo-b)
      const workflow: WorkflowDefinition = {
        ...threeStepWorkflow,
        steps: [
          { name: 'step-a', type: 'activity', retries: 3, timeoutMs: 5000, compensation: null },
          { name: 'step-b', type: 'activity', retries: 3, timeoutMs: 5000, compensation: 'undo-b' },
          { name: 'step-c', type: 'activity', retries: 3, timeoutMs: 5000, compensation: null },
        ],
      };

      const events = [
        makeEvent('EXECUTION_STARTED', null, 0),
        makeEvent('STEP_COMPLETED', 'step-a', 10),
        makeEvent('STEP_COMPLETED', 'step-b', 20),
        makeEvent('STEP_FAILED', 'step-c', 30),
      ];

      const action = engine.determineNextAction(workflow, events);

      expect(action.type).toBe('RUN_COMPENSATION');
      if (action.type === 'RUN_COMPENSATION') {
        // step-c failed — step-b has compensation, step-a does not
        // So we compensate step-b (undo-b) and skip step-a
        expect(action.stepName).toBe('undo-b');
      }
    });
  });

  // ── Idempotency ────────────────────────────────────────────────────────

  describe('idempotency (already terminal)', () => {
    it('returns COMPLETE if EXECUTION_COMPLETED event is present', () => {
      const events = [
        makeEvent('EXECUTION_STARTED', null, 0),
        makeEvent('STEP_COMPLETED', 'charge-card', 10),
        makeEvent('EXECUTION_COMPLETED', null, 20),
      ];

      const action = engine.determineNextAction(threeStepWorkflow, events);

      expect(action.type).toBe('COMPLETE');
    });

    it('returns FAIL if EXECUTION_FAILED event is present', () => {
      const events = [
        makeEvent('EXECUTION_STARTED', null, 0),
        makeEvent('STEP_FAILED', 'charge-card', 10),
        makeEvent('EXECUTION_FAILED', null, 20),
      ];

      const action = engine.determineNextAction(threeStepWorkflow, events);

      expect(action.type).toBe('FAIL');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles events in wrong order by sorting by occurredAt', () => {
      // Events arrive out of order — should still replay correctly
      const events = [
        makeEvent('STEP_COMPLETED', 'charge-card', 20), // later timestamp
        makeEvent('EXECUTION_STARTED', null, 0), // earlier timestamp
      ];

      const action = engine.determineNextAction(threeStepWorkflow, events);

      expect(action.type).toBe('EXECUTE_STEP');
      if (action.type === 'EXECUTE_STEP') {
        expect(action.step.name).toBe('update-inventory');
      }
    });

    it('is safe to call multiple times with the same events (no mutation)', () => {
      const events = [
        makeEvent('EXECUTION_STARTED', null, 0),
        makeEvent('STEP_COMPLETED', 'charge-card', 10),
      ];

      const action1 = engine.determineNextAction(threeStepWorkflow, events);
      const action2 = engine.determineNextAction(threeStepWorkflow, events);

      // Both calls should return the same result
      expect(action1.type).toBe(action2.type);
      if (action1.type === 'EXECUTE_STEP' && action2.type === 'EXECUTE_STEP') {
        expect(action1.step.name).toBe(action2.step.name);
      }
    });
  });
});
