import {
  WorkflowDefinition,
  CreateWorkflowInput,
  NotFoundError,
  createLogger,
} from '@chronos/shared';
import { IWorkflowRepository } from '../repositories/IWorkflowRepository';

const logger = createLogger('orchestrator');

export class WorkflowService {
  constructor(private readonly workflowRepo: IWorkflowRepository) {}

  async register(data: CreateWorkflowInput): Promise<WorkflowDefinition> {
    const workflow = await this.workflowRepo.save(data);
    logger.info('Workflow registered', { workflowId: workflow.id, name: workflow.name });
    return workflow;
  }

  async getById(id: string): Promise<WorkflowDefinition> {
    const workflow = await this.workflowRepo.findById(id);
    if (!workflow) throw new NotFoundError(`Workflow ${id}`);
    return workflow;
  }

  async listAll(): Promise<WorkflowDefinition[]> {
    return this.workflowRepo.findAll();
  }
}
