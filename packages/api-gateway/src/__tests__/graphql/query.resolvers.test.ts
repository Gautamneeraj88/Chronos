import { queryResolvers, GraphQLContext } from '../../graphql/resolvers/query.resolvers';
import { IOrchestratorClient } from '../../http/IOrchestratorClient';

const mockClient = {
  validateApiKey: jest.fn(),
  createWorkflow: jest.fn(),
  listWorkflows: jest.fn(),
  getWorkflow: jest.fn(),
  triggerExecution: jest.fn(),
  getExecution: jest.fn(),
  getExecutionEvents: jest.fn(),
  listExecutions: jest.fn(),
};

const ctx: GraphQLContext = {
  orchestratorClient: mockClient as unknown as IOrchestratorClient,
  orgId: 'org-1',
  userId: 'user-1',
};

beforeEach(() => jest.clearAllMocks());

describe('Query.workflow', () => {
  it('delegates to orchestratorClient.getWorkflow', async () => {
    const wf = { id: 'wf-1', name: 'test' };
    mockClient.getWorkflow.mockResolvedValue(wf);

    const result = await queryResolvers.Query.workflow({}, { id: 'wf-1' }, ctx);

    expect(mockClient.getWorkflow).toHaveBeenCalledWith('wf-1', 'org-1');
    expect(result).toBe(wf);
  });
});

describe('Query.workflows', () => {
  it('delegates to orchestratorClient.listWorkflows', async () => {
    const wfs = [{ id: 'wf-1' }];
    mockClient.listWorkflows.mockResolvedValue(wfs);

    const result = await queryResolvers.Query.workflows({}, {}, ctx);

    expect(mockClient.listWorkflows).toHaveBeenCalledWith('org-1');
    expect(result).toBe(wfs);
  });
});

describe('Query.execution', () => {
  it('merges execution with events', async () => {
    const exec = { id: 'exec-1', status: 'COMPLETED' };
    const events = [{ id: 'ev-1', type: 'EXECUTION_COMPLETED' }];
    mockClient.getExecution.mockResolvedValue(exec);
    mockClient.getExecutionEvents.mockResolvedValue(events);

    const result = await queryResolvers.Query.execution({}, { id: 'exec-1' }, ctx);

    expect(result).toEqual({ ...exec, events });
    expect(mockClient.getExecution).toHaveBeenCalledWith('exec-1', 'org-1');
    expect(mockClient.getExecutionEvents).toHaveBeenCalledWith('exec-1', 'org-1');
  });
});

describe('Query.executions', () => {
  it('delegates to listExecutions with optional status', async () => {
    const list = [{ id: 'exec-1' }];
    mockClient.listExecutions.mockResolvedValue(list);

    const result = await queryResolvers.Query.executions({}, { status: 'RUNNING' }, ctx);

    expect(mockClient.listExecutions).toHaveBeenCalledWith('org-1', 'RUNNING');
    expect(result).toBe(list);
  });

  it('passes undefined status when not provided', async () => {
    mockClient.listExecutions.mockResolvedValue([]);

    await queryResolvers.Query.executions({}, {}, ctx);

    expect(mockClient.listExecutions).toHaveBeenCalledWith('org-1', undefined);
  });
});
