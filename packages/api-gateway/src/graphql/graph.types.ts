/** Shared graph query result types — used by IOrchestratorClient and resolvers. */

export interface WorkflowMatch {
  id: string;
  name: string;
  orgId: string;
}

export interface StepFailureStat {
  step: string;
  activity: string;
  failureCount: number;
}

export interface StepBottleneck {
  step: string;
  activity: string;
  avgDurationMs: number;
  maxDurationMs: number;
  executionCount: number;
}

export interface StepExecutionRecord {
  step: string;
  status: string;
  attemptNumber: number;
  durationMs: number;
  occurredAt: string;
}

export interface ActivityImpact {
  workflowName: string;
  step: string;
  compensatedBy: string;
}
