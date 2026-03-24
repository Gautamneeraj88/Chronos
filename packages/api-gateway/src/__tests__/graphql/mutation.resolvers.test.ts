import { mutationResolvers } from '../../graphql/resolvers/mutation.resolvers';
import { GraphQLContext } from '../../graphql/resolvers/query.resolvers';

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
  orchestratorClient: mockClient as any,
  orgId: 'org-1',
  userId: 'user-1',
};

beforeEach(() => jest.clearAllMocks());

describe('Mutation.registerWorkflow', () => {
  it('delegates to createWorkflow with orgId from context', async () => {
    const wf = { id: 'wf-1', name: 'My Workflow' };
    mockClient.createWorkflow.mockResolvedValue(wf);

    const input = { name: 'My Workflow', steps: [] };
    const result = await mutationResolvers.Mutation.registerWorkflow({}, { input }, ctx);

    expect(mockClient.createWorkflow).toHaveBeenCalledWith(input, 'org-1');
    expect(result).toBe(wf);
  });
});

describe('Mutation.triggerExecution', () => {
  it('triggers execution and merges events', async () => {
    const exec = { id: 'exec-1', status: 'RUNNING' };
    const events = [{ id: 'ev-1' }];
    mockClient.triggerExecution.mockResolvedValue(exec);
    mockClient.getExecutionEvents.mockResolvedValue(events);

    const input = { workflowId: 'wf-1', input: { key: 'val' } };
    const result = await mutationResolvers.Mutation.triggerExecution({}, { input }, ctx);

    expect(mockClient.triggerExecution).toHaveBeenCalledWith('wf-1', { key: 'val' }, 'user-1', 'org-1');
    expect(mockClient.getExecutionEvents).toHaveBeenCalledWith('exec-1', 'org-1');
    expect(result).toEqual({ ...exec, events });
  });

  it('defaults to empty input when not provided', async () => {
    const exec = { id: 'exec-2', status: 'RUNNING' };
    mockClient.triggerExecution.mockResolvedValue(exec);
    mockClient.getExecutionEvents.mockResolvedValue([]);

    await mutationResolvers.Mutation.triggerExecution({}, { input: { workflowId: 'wf-1' } }, ctx);

    expect(mockClient.triggerExecution).toHaveBeenCalledWith('wf-1', {}, 'user-1', 'org-1');
  });
});
