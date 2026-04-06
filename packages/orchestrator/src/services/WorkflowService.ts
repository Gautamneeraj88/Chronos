import {
  WorkflowDefinition,
  CreateWorkflowInput,
  NotFoundError,
  createLogger,
} from '@chronos/shared';
import type Redis from 'ioredis';
import { IWorkflowRepository } from '../repositories/IWorkflowRepository';
import { WorkflowGraphService } from './WorkflowGraphService';

const logger = createLogger('orchestrator');

const CACHE_TTL = 30; // seconds

export class WorkflowService {
  constructor(
    private readonly workflowRepo: IWorkflowRepository,
    private readonly graphService?: WorkflowGraphService,
    private readonly redis?: Redis,
  ) {}

  async register(data: CreateWorkflowInput): Promise<WorkflowDefinition> {
    const workflow = await this.workflowRepo.save(data);
    logger.info('Workflow registered', { workflowId: workflow.id, name: workflow.name });
    this.graphService?.syncWorkflow(workflow);
    await this.invalidateCache(data.orgId);
    return workflow;
  }

  async getById(id: string, orgId: string): Promise<WorkflowDefinition> {
    const workflow = await this.workflowRepo.findById(id, orgId);
    if (!workflow) throw new NotFoundError(`Workflow ${id}`);
    return workflow;
  }

  async listAll(orgId: string): Promise<WorkflowDefinition[]> {
    if (!this.redis) return this.workflowRepo.findAll(orgId);

    const cacheKey = `workflows:${orgId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as WorkflowDefinition[];

    const workflows = await this.workflowRepo.findAll(orgId);
    await this.redis.set(cacheKey, JSON.stringify(workflows), 'EX', CACHE_TTL);
    return workflows;
  }

  private async invalidateCache(orgId: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(`workflows:${orgId}`);
    }
  }
}
