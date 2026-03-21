import { Execution, ExecutionStatus } from '@chronos/shared';

export interface IExecutionRepository {
  save(execution: Execution): Promise<Execution>;
  findById(id: string): Promise<Execution | null>;
  findByStatus(status: ExecutionStatus): Promise<Execution[]>;
  updateStatus(
    id: string,
    status: ExecutionStatus,
    extra?: Partial<Pick<Execution, 'completedAt' | 'error' | 'output' | 'currentStepIndex'>>,
  ): Promise<void>;
}
