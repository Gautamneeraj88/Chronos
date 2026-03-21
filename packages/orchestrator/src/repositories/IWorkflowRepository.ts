import { WorkflowDefinition, CreateWorkflowInput } from '@chronos/shared';

export interface IWorkflowRepository {
  save(data: CreateWorkflowInput): Promise<WorkflowDefinition>;
  findById(id: string): Promise<WorkflowDefinition | null>;
  findByName(name: string): Promise<WorkflowDefinition | null>;
  findAll(): Promise<WorkflowDefinition[]>;
}
