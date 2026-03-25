export type DomainEventType =
  | 'EXECUTION_STARTED'
  | 'EXECUTION_COMPLETED'
  | 'EXECUTION_FAILED'
  | 'STEP_STARTED'
  | 'STEP_IN_FLIGHT'
  | 'STEP_COMPLETED'
  | 'STEP_FAILED'
  | 'COMPENSATION_STARTED'
  | 'COMPENSATION_COMPLETED'
  | 'COMPENSATION_FAILED';

export interface DomainEvent {
  id: string;
  executionId: string;
  type: DomainEventType;
  stepName: string | null;
  payload: Record<string, unknown>;
  occurredAt: Date;
}
