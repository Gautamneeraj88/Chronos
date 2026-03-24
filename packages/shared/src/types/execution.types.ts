export type ExecutionStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "COMPENSATING"
  | "FAILED";

export interface Execution {
  id: string;
  orgId: string;
  workflowId: string;
  workflowVersion: number;
  status: ExecutionStatus;
  currentStepIndex: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdBy: string;
}
