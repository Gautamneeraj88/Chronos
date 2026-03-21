import { DomainEvent } from '@chronos/shared';

export interface IEventRepository {
  // Only ever appends - never updates or deletes
  append(event: DomainEvent): Promise<void>;
  findByExecutionId(executionId: string): Promise<DomainEvent[]>;
}
