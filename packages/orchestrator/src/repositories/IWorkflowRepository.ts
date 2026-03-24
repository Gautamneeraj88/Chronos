import { WorkflowDefinition, CreateWorkflowInput } from '@chronos/shared';

export interface IWorkflowRepository {
  save(data: CreateWorkflowInput): Promise<WorkflowDefinition>;
  findById(id: string, orgId: string): Promise<WorkflowDefinition | null>;
  findByIdAndVersion(id: string, version: number, orgId: string): Promise<WorkflowDefinition | null>;
  findByName(name: string, orgId: string): Promise<WorkflowDefinition | null>;
  findAll(orgId: string): Promise<WorkflowDefinition[]>;
}
