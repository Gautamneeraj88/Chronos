//What the orchestrator publishes to chronos.step.execute
export interface StepExecuteMessage {
  executionId: string;
  workflowId: string;
  stepId: string;
  activityName: string;
  input: Record<string, unknown>;
  attemptNumber: number;
}

//What the worker publishes to chronos.step.result
export interface StepResultMessage {
  executionId: string;
  stepId: string;
  success: boolean;
  output: Record<string, unknown>;
  error?: string;
}
