import { Execution, ExecutionStatus, NotFoundError } from '@chronos/shared';
import { ExecutionModel } from '../models/execution.model';
import { IExecutionRepository } from './IExecutionRepository';

export class MongoExecutionRepository implements IExecutionRepository {
  async save(execution: Execution): Promise<Execution> {
    const doc = await ExecutionModel.create(execution);
    return this.toPlain(doc);
  }

  async getById(id: string): Promise<Execution> {
    const doc = await ExecutionModel.findOne({ id });
    return doc ? this.toPlain(doc) : null;
  }

  async findByStatus(status: ExecutionStatus): Promise<Execution[]> {
    const docs = await ExecutionModel.find({ status });
    return docs.map((d) => this.toPlain(d));
  }

  async updateStatus(
    id: string,
    status: ExecutionStatus,
    extra?: Partial<Pick<Execution, 'completedAt' | 'error' | 'output' | 'currentStepIndex'>>,
  ): Promise<void> {
    const result = await ExecutionModel.updateOne({ id }, { $set: { status, ...extra } });

    if (result.matchedCount === 0) {
      throw new NotFoundError(`Execution ${id}`);
    }
  }

  private toPlain(doc: any): Execution {
    return {
      id: doc.id,
      workflowId: doc.workflowId,
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
