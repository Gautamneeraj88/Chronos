import { v4 as uuidv4 } from 'uuid';
import { MongoEventRepository } from '../repositories/EventRepository';
import { DomainEvent } from '@chronos/shared';

const repo = new MongoEventRepository();

function makeEvent(executionId: string, type: DomainEvent['type'], offsetMs = 0): DomainEvent {
  return {
    id: uuidv4(),
    executionId,
    type,
    stepName: null,
    payload: {},
    occurredAt: new Date(Date.now() + offsetMs),
  };
}

describe('MongoEventRepository', () => {

  it('appends events and returns them in chronological order', async () => {
    const execId = uuidv4();

    await repo.append(makeEvent(execId, 'EXECUTION_STARTED', 0));
    await repo.append(makeEvent(execId, 'STEP_STARTED', 10));
    await repo.append(makeEvent(execId, 'STEP_COMPLETED', 20));

    const events = await repo.findByExecutionId(execId);
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('EXECUTION_STARTED');
    expect(events[1].type).toBe('STEP_STARTED');
    expect(events[2].type).toBe('STEP_COMPLETED');
  });

  it('returns only events for the given executionId', async () => {
    const execA = uuidv4();
    const execB = uuidv4();

    await repo.append(makeEvent(execA, 'EXECUTION_STARTED'));
    await repo.append(makeEvent(execB, 'EXECUTION_STARTED'));

    const eventsA = await repo.findByExecutionId(execA);
    expect(eventsA).toHaveLength(1);
    expect(eventsA[0].executionId).toBe(execA);
  });

  it('returns empty array for unknown executionId', async () => {
    const events = await repo.findByExecutionId('unknown-id');
    expect(events).toHaveLength(0);
  });
});
