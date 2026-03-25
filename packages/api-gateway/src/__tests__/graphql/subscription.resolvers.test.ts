import { subscriptionResolvers } from '../../graphql/resolvers/subscription.resolvers';
import { GraphQLContext } from '../../graphql/resolvers/query.resolvers';
import { IOrchestratorClient } from '../../http/IOrchestratorClient';

type SubPayload = { executionUpdated: { id: string; status: string } };

const mockClient = {
  validateApiKey: jest.fn(),
  createWorkflow: jest.fn(),
  listWorkflows: jest.fn(),
  getWorkflow: jest.fn(),
  triggerExecution: jest.fn(),
  getExecution: jest.fn(),
  getExecutionEvents: jest.fn(),
  listExecutions: jest.fn(),
  workflowsByActivity: jest.fn(),
  failurePaths: jest.fn(),
  bottlenecks: jest.fn(),
  executionGraph: jest.fn(),
  activityDependencyImpact: jest.fn(),
};

const ctx: GraphQLContext = {
  orchestratorClient: mockClient as unknown as IOrchestratorClient,
  orgId: 'org-1',
  userId: 'user-1',
};

beforeEach(() => jest.clearAllMocks());

async function collectYields(
  gen: AsyncGenerator<unknown>,
  count: number,
): Promise<unknown[]> {
  const results: unknown[] = [];
  for await (const value of gen) {
    results.push(value);
    if (results.length >= count) break;
  }
  return results;
}

describe('Subscription.executionUpdated', () => {
  it('yields immediately when status changes on first poll', async () => {
    const exec = { id: 'exec-1', status: 'RUNNING' };
    mockClient.getExecution.mockResolvedValue(exec);
    mockClient.getExecutionEvents.mockResolvedValue([]);

    const gen = subscriptionResolvers.Subscription.executionUpdated.subscribe(
      {},
      { executionId: 'exec-1' },
      ctx,
    ) as AsyncGenerator<unknown>;

    const [first] = await collectYields(gen, 1);

    expect(first).toEqual({ executionUpdated: { ...exec, events: [] } });
    gen.return(undefined); // clean up
  });

  it('terminates when execution reaches COMPLETED', async () => {
    const execRunning = { id: 'exec-1', status: 'RUNNING' };
    const execDone = { id: 'exec-1', status: 'COMPLETED' };

    mockClient.getExecution
      .mockResolvedValueOnce(execRunning)
      .mockResolvedValueOnce(execDone);
    mockClient.getExecutionEvents.mockResolvedValue([]);

    const gen = subscriptionResolvers.Subscription.executionUpdated.subscribe(
      {},
      { executionId: 'exec-1' },
      ctx,
    ) as AsyncGenerator<unknown>;

    const results: unknown[] = [];
    for await (const value of gen) {
      results.push(value);
    }

    // RUNNING (status change), COMPLETED (status change) → 2 yields then done
    expect(results).toHaveLength(2);
    expect((results[1] as SubPayload).executionUpdated.status).toBe('COMPLETED');
  });

  it('terminates when execution reaches FAILED', async () => {
    const execFailed = { id: 'exec-1', status: 'FAILED' };
    mockClient.getExecution.mockResolvedValue(execFailed);
    mockClient.getExecutionEvents.mockResolvedValue([]);

    const gen = subscriptionResolvers.Subscription.executionUpdated.subscribe(
      {},
      { executionId: 'exec-1' },
      ctx,
    ) as AsyncGenerator<unknown>;

    const results: unknown[] = [];
    for await (const value of gen) {
      results.push(value);
    }

    expect(results).toHaveLength(1);
    expect((results[0] as SubPayload).executionUpdated.status).toBe('FAILED');
  });

  it('does not yield when status is unchanged', async () => {
    const exec = { id: 'exec-1', status: 'RUNNING' };
    const execDone = { id: 'exec-1', status: 'COMPLETED' };

    // First call: RUNNING (new) → yield; second: RUNNING (same) → skip; third: COMPLETED → yield + break
    mockClient.getExecution
      .mockResolvedValueOnce(exec)
      .mockResolvedValueOnce(exec)
      .mockResolvedValueOnce(execDone);
    mockClient.getExecutionEvents.mockResolvedValue([]);

    const gen = subscriptionResolvers.Subscription.executionUpdated.subscribe(
      {},
      { executionId: 'exec-1' },
      ctx,
    ) as AsyncGenerator<unknown>;

    const results: unknown[] = [];
    for await (const value of gen) {
      results.push(value);
    }

    // RUNNING (yield), RUNNING (skip), COMPLETED (yield + break) → 2 total
    expect(results).toHaveLength(2);
  });
});
