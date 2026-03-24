export interface ExecutionNotification {
  executionId: string;
  workflowId: string;
  orgId: string;
  status: 'COMPLETED' | 'FAILED';
  output?: Record<string, unknown>;
  error?: string | null;
  completedAt: string; // ISO-8601
}
