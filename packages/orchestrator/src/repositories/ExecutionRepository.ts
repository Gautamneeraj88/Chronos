import { Execution, ExecutionStatus, NotFoundError } from '@chronos/shared';
import { ExecutionDocument, ExecutionModel } from '../models/execution.model';
import { IExecutionRepository } from './IExecutionRepository';

export class MongoExecutionRepository implements IExecutionRepository {
  async save(execution: Execution): Promise<Execution> {
    const doc = await ExecutionModel.create(execution);
    return this.toPlain(doc);
  }

  async findById(id: string, orgId?: string): Promise<Execution | null> {
    const query = orgId ? { id, orgId } : { id };
    const doc = await ExecutionModel.findOne(query);
    return doc ? this.toPlain(doc) : null;
  }

  async findByStatus(status: ExecutionStatus): Promise<Execution[]> {
    const docs = await ExecutionModel.find({ status });
    return docs.map((d) => this.toPlain(d));
  }

  async listByOrgAndStatus(orgId: string, status?: ExecutionStatus): Promise<Execution[]> {
    const query = status ? { orgId, status } : { orgId };
    // Projection: exclude large fields (input/output) from list — fetch them in getExecution only
    const docs = await ExecutionModel
      .find(query)
      .select('id orgId workflowId workflowVersion status currentStepIndex error startedAt completedAt createdBy')
      .sort({ startedAt: -1 })
      .lean();
    return docs.map((d) => ({
      id: d.id as string,
      orgId: d.orgId,
      workflowId: d.workflowId,
      workflowVersion: d.workflowVersion,
      status: d.status,
      currentStepIndex: d.currentStepIndex,
      input: {},
      output: {},
      error: d.error,
      startedAt: d.startedAt,
      completedAt: d.completedAt,
      createdBy: d.createdBy,
    }));
  }

  async listByDlq(orgId: string): Promise<Execution[]> {
    const docs = await ExecutionModel
      .find({ orgId, status: 'DLQ' })
      .select('id orgId workflowId workflowVersion status currentStepIndex error startedAt completedAt dlqAt createdBy')
      .sort({ dlqAt: -1 })
      .lean();
    return docs.map((d) => ({
      id: d.id as string,
      orgId: d.orgId,
      workflowId: d.workflowId,
      workflowVersion: d.workflowVersion,
      status: d.status,
      currentStepIndex: d.currentStepIndex,
      input: {},
      output: {},
      error: d.error,
      startedAt: d.startedAt,
      completedAt: d.completedAt,
      dlqAt: (d as unknown as { dlqAt?: Date | null }).dlqAt ?? null,
      createdBy: d.createdBy,
    }));
  }

  async updateStatus(
    id: string,
    status: ExecutionStatus,
    extra?: Partial<Pick<Execution, 'completedAt' | 'error' | 'output' | 'currentStepIndex' | 'dlqAt'>>,
  ): Promise<void> {
    const result = await ExecutionModel.updateOne({ id }, { $set: { status, ...extra } });

    if (result.matchedCount === 0) {
      throw new NotFoundError(`Execution ${id}`);
    }
  }

  private toPlain(doc: ExecutionDocument): Execution {
    return {
      id: doc.id,
      orgId: doc.orgId,
      workflowId: doc.workflowId,
      workflowVersion: doc.workflowVersion,
      status: doc.status,
      currentStepIndex: doc.currentStepIndex,
      input: doc.input,
      output: doc.output,
      error: doc.error,
      startedAt: doc.startedAt,
      completedAt: doc.completedAt,
      createdBy: doc.createdBy,
    };
  }
}
