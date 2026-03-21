import { DomainEvent } from '@chronos/shared';

export interface IEventRepository {
  // Only ever appends - never updates or deletes
  append(event: DomainEvent): Promise<void>;
  getByExecutionId(executionId: string): Promise<DomainEvent>;
}
