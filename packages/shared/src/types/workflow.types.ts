//TODO: WorkflowDefinition, WorkflowStep

export interface WorkflowStep {
  name: string;
  type: 'activity';
  retries: number;
  timeoutMs: number;
  compensation: string | null;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: number;
  steps: WorkflowStep[];
  createdAt: Date;
  updatedAt: Date;
}
