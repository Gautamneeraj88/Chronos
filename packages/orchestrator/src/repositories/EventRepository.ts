import { DomainEvent } from '@chronos/shared';
import { EventModel } from '../models/event.model';
import { IEventRepository } from './IEventRepository';

export class MongoEventRepository implements IEventRepository {
  // append ONLY — never update, never delete
  // If you ever find yourself calling update() here, something is wrong
  async append(event: DomainEvent): Promise<void> {
    await EventModel.create(event);
  }

  async findByExecutionId(executionId: string): Promise<DomainEvent[]> {
    const docs = await EventModel.find({ executionId }).sort({ occurredAt: 1 }); // ASC — oldest first, critical for event replay

    return docs.map((doc) => ({
      id: doc.id,
      executionId: doc.executionId,
      type: doc.type,
      stepName: doc.stepName,
      payload: doc.payload,
      occurredAt: doc.occurredAt,
    }));
  }
}
