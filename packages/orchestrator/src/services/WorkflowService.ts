import {
  WorkflowDefinition,
  CreateWorkflowInput,
  NotFoundError,
  createLogger,
} from '@chronos/shared';
import { IWorkflowRepository } from '../repositories/IWorkflowRepository';
import { WorkflowGraphService } from './WorkflowGraphService';

const logger = createLogger('orchestrator');

export class WorkflowService {
  constructor(
    private readonly workflowRepo: IWorkflowRepository,
    private readonly graphService?: WorkflowGraphService,
  ) {}

  async register(data: CreateWorkflowInput): Promise<WorkflowDefinition> {
    const workflow = await this.workflowRepo.save(data);
    logger.info('Workflow registered', { workflowId: workflow.id, name: workflow.name });
    // Fire-and-forget — Neo4j is secondary, never block registration
    this.graphService?.syncWorkflow(workflow);
    return workflow;
  }

  async getById(id: string, orgId: string): Promise<WorkflowDefinition> {
    const workflow = await this.workflowRepo.findById(id, orgId);
    if (!workflow) throw new NotFoundError(`Workflow ${id}`);
    return workflow;
  }

  async listAll(orgId: string): Promise<WorkflowDefinition[]> {
    return this.workflowRepo.findAll(orgId);
  }
}
