import request from 'supertest';
import { createApp } from '../app';
import { loadConfig } from '../config/config';
import { IOrchestratorClient } from '../http';

// Fake orchestrator client - implements the interface, does nothing real
const fakeOrchestrator: IOrchestratorClient = {
  createWorkflow: jest.fn(),
  listWorkflows: jest.fn(),
  getWorkflow: jest.fn(),
  triggerExecution: jest.fn(),
  getExecution: jest.fn(),
  getExecutionEvents: jest.fn(),
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

describe('auth middleware', () => {
  it('returns 401 when no Authorization header', async () => {
    const res = await request(app).post('/workflows').send({ name: 'test' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .post('/workflows')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ name: 'test' });
    expect(res.status).toBe(401);
  });
});
