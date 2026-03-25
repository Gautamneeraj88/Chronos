import { WorkflowDefinition, Execution, DomainEvent, CreateWorkflowInput } from '@chronos/shared';

export interface ValidatedAuth {
  orgId: string;
  userId: string;
}

// Interface - what routes depend on
// This is what you mock in tests
export interface IOrchestratorClient {
  validateApiKey(rawKey: string): Promise<ValidatedAuth | null>;
  createWorkflow(data: CreateWorkflowInput, orgId: string): Promise<WorkflowDefinition>;
  listWorkflows(orgId: string): Promise<WorkflowDefinition[]>;
  getWorkflow(id: string, orgId: string): Promise<WorkflowDefinition>;
  triggerExecution(
    workflowId: string,
    input: Record<string, unknown>,
    userId: string,
    orgId: string,
  ): Promise<Execution>;
  getExecution(id: string, orgId: string): Promise<Execution>;
  getExecutionEvents(executionId: string, orgId: string): Promise<DomainEvent[]>;
  listExecutions(orgId: string, status?: string): Promise<Execution[]>;
}
