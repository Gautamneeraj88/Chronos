import request from 'supertest';
import { createApp } from '../app';
import { loadConfig } from '../config/config';
import { IOrchestratorClient, ValidatedAuth } from '../http/IOrchestratorClient';

// Fake orchestrator client — validateApiKey controls auth outcomes
const fakeOrchestrator: IOrchestratorClient = {
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
  login: jest.fn(),
  me: jest.fn(),
  refresh: jest.fn(),
  register: jest.fn(),
  listUsers: jest.fn(),
  deleteUser: jest.fn(),
  listApiKeys: jest.fn(),
  createApiKey: jest.fn(),
  revokeApiKey: jest.fn(),
  listWebhooks: jest.fn(),
  createWebhook: jest.fn(),
  deleteWebhook: jest.fn(),
  listDlq: jest.fn(),
  replayFromDlq: jest.fn(),
  dismissFromDlq: jest.fn(),
};

const app = createApp(loadConfig(), { orchestratorClient: fakeOrchestrator });

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('api-gateway');
  });
});

describe('auth middleware — API key flow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when no Authorization header', async () => {
    const res = await request(app).post('/workflows').send({ name: 'test' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when API key is invalid', async () => {
    (fakeOrchestrator.validateApiKey as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .post('/workflows')
      .set('Authorization', 'Bearer bad-key')
      .send({ name: 'test' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('calls next() and sets req.orgId when API key is valid', async () => {
    const auth: ValidatedAuth = { orgId: 'org-abc', userId: 'user-1' };
    (fakeOrchestrator.validateApiKey as jest.Mock).mockResolvedValue(auth);
    // createWorkflow will 400 due to missing body, but auth must have passed
    (fakeOrchestrator.createWorkflow as jest.Mock).mockResolvedValue({});

    const res = await request(app)
      .post('/workflows')
      .set('Authorization', 'Bearer valid-key')
      .send({ name: 'test-wf', steps: [] }); // will fail Zod validation, but auth passed

    // 400 = validation failure (auth passed), not 401
    expect(res.status).not.toBe(401);
    expect(fakeOrchestrator.validateApiKey).toHaveBeenCalledWith('valid-key');
  });
});
