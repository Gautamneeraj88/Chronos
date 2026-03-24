import { v4 as uuidv4 } from 'uuid';
import {
  WorkflowDefinition,
  CreateWorkflowInput,
  ConflictError,
  DEFAULT_RETRIES,
  DEFAULT_TIMEOUT_MS,
} from '@chronos/shared';
import { WorkflowModel } from '../models';
import { WorkflowDocument } from '../models/workflow.model';
import { IWorkflowRepository } from './IWorkflowRepository';

export class MongoWorkflowRepository implements IWorkflowRepository {
  async save(data: CreateWorkflowInput): Promise<WorkflowDefinition> {
    // INFO: check for name conflict before inserting
    const existing = await WorkflowModel.findOne({
      name: data.name,
    });
    if (existing) {
      throw new ConflictError(`Workflow with name '${data.name}' already exists`);
    }

    const workflow = await WorkflowModel.create({
      id: uuidv4(),
      name: data.name,
      version: 1,
      steps: data.steps.map((step) => ({
        name: step.name,
        type: step.type ?? 'activity',
        activity: step.activity,
        retries: step.retries ?? DEFAULT_RETRIES,
        timeoutMs: step.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        compensation: step.compensation ?? null,
      })),
    });

    return this.toPlain(workflow);
  }

  async findById(id: string): Promise<WorkflowDefinition | null> {
    const doc = await WorkflowModel.findOne({ id });
    return doc ? this.toPlain(doc) : null;
  }

  async findByIdAndVersion(id: string, version: number): Promise<WorkflowDefinition | null> {
    const doc = await WorkflowModel.findOne({ id, version });
    return doc ? this.toPlain(doc) : null;
  }

  async findByName(name: string): Promise<WorkflowDefinition | null> {
    const doc = await WorkflowModel.findOne({ name });
    return doc ? this.toPlain(doc) : null;
  }

  async findAll(): Promise<WorkflowDefinition[]> {
    const docs = await WorkflowModel.find().sort({ createdAt: -1 });
    return docs.map(this.toPlain);
  }

  // Convert Mongoose document to plain object
  // Never return raw Mongoose documents outside the repository
  // They carry extra methods and proxies that cause subtle bugs
  private toPlain(doc: WorkflowDocument): WorkflowDefinition {
    return {
      id: doc.id,
      name: doc.name,
      version: doc.version,
      steps: doc.steps,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
