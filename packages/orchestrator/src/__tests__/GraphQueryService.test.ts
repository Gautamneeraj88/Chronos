import { GraphQueryService } from '../services/GraphQueryService';

// Mock record builder — mimics neo4j Record.get()
function makeRecord(data: Record<string, unknown>) {
  return { get: (key: string) => data[key] };
}

const mockSession = {
  run: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};
const mockNeo4j = {
  getSession: jest.fn().mockReturnValue(mockSession),
};

const service = new GraphQueryService(mockNeo4j as never);

beforeEach(() => {
  jest.clearAllMocks();
  mockNeo4j.getSession.mockReturnValue(mockSession);
  mockSession.close.mockResolvedValue(undefined);
});

describe('GraphQueryService.workflowsByActivity', () => {
  it('returns mapped workflows matching the activity', async () => {
    mockSession.run.mockResolvedValueOnce({
      records: [
        makeRecord({ id: 'wf-1', name: 'Order Flow', orgId: 'org-1' }),
        makeRecord({ id: 'wf-2', name: 'Refund Flow', orgId: 'org-1' }),
      ],
    });

    const result = await service.workflowsByActivity('charge-card');

    expect(result).toEqual([
      { id: 'wf-1', name: 'Order Flow', orgId: 'org-1' },
      { id: 'wf-2', name: 'Refund Flow', orgId: 'org-1' },
    ]);
    expect(mockSession.run.mock.calls[0][1]).toMatchObject({ activityName: 'charge-card' });
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when no workflows match', async () => {
    mockSession.run.mockResolvedValueOnce({ records: [] });
    const result = await service.workflowsByActivity('nonexistent');
    expect(result).toEqual([]);
  });

  it('returns empty array on Neo4j error and closes session', async () => {
    mockSession.run.mockRejectedValueOnce(new Error('connection refused'));
    const result = await service.workflowsByActivity('charge-card');
    expect(result).toEqual([]);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });
});

describe('GraphQueryService.failurePaths', () => {
  it('returns failure stats ordered by count', async () => {
    mockSession.run.mockResolvedValueOnce({
      records: [
        makeRecord({ step: 'charge-card', activity: 'charge-card', failureCount: 5 }),
        makeRecord({ step: 'update-inventory', activity: 'update-inventory', failureCount: 2 }),
      ],
    });

    const result = await service.failurePaths('org-1');

    expect(result).toHaveLength(2);
    expect(result[0].failureCount).toBe(5);
    expect(result[1].failureCount).toBe(2);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('returns empty array on error', async () => {
    mockSession.run.mockRejectedValueOnce(new Error('query failed'));
    const result = await service.failurePaths('org-1');
    expect(result).toEqual([]);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });
});

describe('GraphQueryService.bottlenecks', () => {
  it('returns step performance data', async () => {
    mockSession.run.mockResolvedValueOnce({
      records: [
        makeRecord({ step: 'update-inventory', activity: 'update-inventory', avgDurationMs: 4800, maxDurationMs: 5000, executionCount: 10 }),
      ],
    });

    const result = await service.bottlenecks('org-1');

    expect(result).toHaveLength(1);
    expect(result[0].step).toBe('update-inventory');
    expect(result[0].avgDurationMs).toBe(4800);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('returns empty array on error', async () => {
    mockSession.run.mockRejectedValueOnce(new Error('Neo4j unavailable'));
    const result = await service.bottlenecks('org-1');
    expect(result).toEqual([]);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });
});

describe('GraphQueryService.activityDependencyImpact', () => {
  it('returns impact records for the given activity', async () => {
    mockSession.run.mockResolvedValueOnce({
      records: [
        makeRecord({ workflowName: 'Order Flow', step: 'charge-card', compensatedBy: 'refund-card' }),
      ],
    });

    const result = await service.activityDependencyImpact('charge-card');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ workflowName: 'Order Flow', step: 'charge-card', compensatedBy: 'refund-card' });
    expect(mockSession.run.mock.calls[0][1]).toMatchObject({ activityName: 'charge-card' });
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when no impact found', async () => {
    mockSession.run.mockResolvedValueOnce({ records: [] });
    const result = await service.activityDependencyImpact('nonexistent');
    expect(result).toEqual([]);
  });

  it('returns empty array on error and closes session', async () => {
    mockSession.run.mockRejectedValueOnce(new Error('query failed'));
    const result = await service.activityDependencyImpact('charge-card');
    expect(result).toEqual([]);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });
});

describe('GraphQueryService.executionGraph', () => {
  it('returns step execution records ordered by time', async () => {
    mockSession.run.mockResolvedValueOnce({
      records: [
        makeRecord({ step: 'charge-card', status: 'COMPLETED', attemptNumber: 1, durationMs: 150, occurredAt: '2026-01-15T10:00:00.000Z' }),
        makeRecord({ step: 'update-inventory', status: 'COMPLETED', attemptNumber: 1, durationMs: 4800, occurredAt: '2026-01-15T10:00:00.200Z' }),
      ],
    });

    const result = await service.executionGraph('exec-1');

    expect(result).toHaveLength(2);
    expect(result[0].step).toBe('charge-card');
    expect(result[1].step).toBe('update-inventory');
    expect(result[0].durationMs).toBe(150);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('returns empty array on error', async () => {
    mockSession.run.mockRejectedValueOnce(new Error('graph query failed'));
    const result = await service.executionGraph('exec-1');
    expect(result).toEqual([]);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });
});
