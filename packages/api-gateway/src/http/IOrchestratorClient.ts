import { WorkflowDefinition, Execution, DomainEvent, CreateWorkflowInput } from '@chronos/shared';

// Interface - what routes depend on
// This is what you mock in tests
export interface IOrchestratorClient {
  createWorkflow(data: CreateWorkflowInput): Promise<WorkflowDefinition>;
  listWorkflows(): Promise<WorkflowDefinition[]>;
  getWorkflow(id: string): Promise<WorkflowDefinition>;
  triggerExecution(
    workflowId: string,
    input: Record<string, unknown>,
    userId: string,
  ): Promise<Execution>;
  getExecution(id: string): Promise<Execution>;
  getExecutionEvents(executionId: string): Promise<DomainEvent[]>;
}
