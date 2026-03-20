//TODO: WorkflowDefinition, WorkflowStep


export interface WoekflowStep {
  name: string;
  type: "activity";
  retries: number;
  timeoutMs: number;
  compensation: string | null;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: number;
  steps: WoekflowStep[];
  createdAt: Date;
  updatedAt: Date;
}


