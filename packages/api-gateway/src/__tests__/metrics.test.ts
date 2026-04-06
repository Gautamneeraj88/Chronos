import request from 'supertest';
import { createApp } from '../app';
import { loadConfig } from '../config/config';
import { IOrchestratorClient } from '../http/IOrchestratorClient';

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

describe('GET /metrics', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
  });

  it('returns Prometheus text format content-type', async () => {
    const res = await request(app).get('/metrics');
    expect(res.headers['content-type']).toMatch(/text\/plain/);
  });

  it('contains chronos_gateway_requests_total counter', async () => {
    const res = await request(app).get('/metrics');
    expect(res.text).toContain('chronos_gateway_requests_total');
  });

  it('contains chronos_gateway_auth_failures_total counter', async () => {
    const res = await request(app).get('/metrics');
    expect(res.text).toContain('chronos_gateway_auth_failures_total');
  });

  it('contains chronos_gateway_request_duration_ms histogram', async () => {
    const res = await request(app).get('/metrics');
    expect(res.text).toContain('chronos_gateway_request_duration_ms');
  });
});
