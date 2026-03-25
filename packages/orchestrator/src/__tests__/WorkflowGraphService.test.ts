import { WorkflowGraphService } from '../services/WorkflowGraphService';
import { WorkflowDefinition } from '@chronos/shared';

// Mock Neo4jClient — never connect to real Neo4j in unit tests
const mockTx = { run: jest.fn().mockResolvedValue(undefined) };
const mockSession = {
  executeWrite: jest.fn().mockImplementation((fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx)),
  close: jest.fn().mockResolvedValue(undefined),
};
const mockNeo4j = {
  getSession: jest.fn().mockReturnValue(mockSession),
};

const graphService = new WorkflowGraphService(mockNeo4j as never);

const baseWorkflow: WorkflowDefinition = {
  id: 'wf-1',
  orgId: 'org-1',
  name: 'Order Workflow',
  version: 1,
  steps: [
    { name: 'charge-card', type: 'activity', activity: 'charge-card', retries: 2, timeoutMs: 5000, compensation: 'refund-card' },
    { name: 'update-inventory', type: 'activity', activity: 'update-inventory', retries: 1, timeoutMs: 10000, compensation: null },
  ],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.executeWrite.mockImplementation((fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));
});

describe('WorkflowGraphService.syncWorkflow', () => {
  it('opens a session and runs MERGE for the workflow node', async () => {
    await graphService.syncWorkflow(baseWorkflow);

    expect(mockNeo4j.getSession).toHaveBeenCalledTimes(1);
    expect(mockSession.executeWrite).toHaveBeenCalledTimes(1);
    // First tx.run call should MERGE the Workflow node
    const firstCall = mockTx.run.mock.calls[0];
    expect(firstCall[0]).toContain('MERGE (w:Workflow { id: $id })');
    expect(firstCall[1]).toMatchObject({ id: 'wf-1', name: 'Order Workflow', orgId: 'org-1', version: 1 });
  });

  it('runs a MERGE for each step and its activity', async () => {
    await graphService.syncWorkflow(baseWorkflow);

    // tx.run is called once for the workflow + once per step + once per compensation
    // Step 1 (charge-card) has a compensation (refund-card) → 3 tx.run calls minimum
    const calls = mockTx.run.mock.calls;
    const stepCalls = calls.filter((c: unknown[]) => (c[0] as string).includes('MERGE (s:Step'));
    expect(stepCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('always closes the session', async () => {
    await graphService.syncWorkflow(baseWorkflow);
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });

  it('does not throw when executeWrite fails', async () => {
    mockSession.executeWrite.mockRejectedValueOnce(new Error('Neo4j down'));
    await expect(graphService.syncWorkflow(baseWorkflow)).resolves.not.toThrow();
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });
});

describe('WorkflowGraphService.recordExecutionStarted', () => {
  const execution = {
    id: 'exec-1',
    orgId: 'org-1',
    workflowId: 'wf-1',
    workflowVersion: 1,
    status: 'RUNNING' as const,
    currentStepIndex: 0,
    input: {},
    output: {},
    error: null,
    startedAt: new Date('2026-01-15'),
    completedAt: null,
    createdBy: 'user-1',
  };

  it('merges an Execution node and RUNS relationship', async () => {
    await graphService.recordExecutionStarted(execution);

    const firstCall = mockTx.run.mock.calls[0];
    expect(firstCall[0]).toContain('MERGE (e:Execution { id: $id })');
    expect(firstCall[0]).toContain('MERGE (e)-[:RUNS]->(w)');
    expect(firstCall[1]).toMatchObject({ id: 'exec-1', orgId: 'org-1', workflowId: 'wf-1' });
  });

  it('closes the session even on failure', async () => {
    mockSession.executeWrite.mockRejectedValueOnce(new Error('timeout'));
    await expect(graphService.recordExecutionStarted(execution)).resolves.not.toThrow();
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });
});

describe('WorkflowGraphService.recordStepExecution', () => {
  it('creates an EXECUTED_STEP relationship with correct properties', async () => {
    await graphService.recordStepExecution('wf-1', 'exec-1', 'charge-card', 'COMPLETED', 1, 1234);

    const call = mockTx.run.mock.calls[0];
    expect(call[0]).toContain('CREATE (e)-[:EXECUTED_STEP {');
    expect(call[1]).toMatchObject({
      executionId: 'exec-1',
      stepId: 'wf-1:charge-card',
      status: 'COMPLETED',
      attemptNumber: 1,
      durationMs: 1234,
    });
  });

  it('closes the session on failure without throwing', async () => {
    mockSession.executeWrite.mockRejectedValueOnce(new Error('connection lost'));
    await expect(
      graphService.recordStepExecution('wf-1', 'exec-1', 'charge-card', 'FAILED', 1, 500),
    ).resolves.not.toThrow();
    expect(mockSession.close).toHaveBeenCalledTimes(1);
  });
});
