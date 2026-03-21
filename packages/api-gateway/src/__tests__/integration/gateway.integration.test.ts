import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app';
import { loadConfig } from '../../config/config';
import { IOrchestratorClient } from '../../http/IOrchestratorClient';
import { NotFoundError } from '@chronos/shared';

const config = loadConfig();

function makeToken(payload = { userId: 'test-user', email: 'test@chronos.local' }) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
}

function makeOrchestrator(overrides: Partial<IOrchestratorClient> = {}): IOrchestratorClient {
  return {
    createWorkflow:     jest.fn().mockResolvedValue({ id: 'wf-1', name: 'test', version: 1, steps: [], createdAt: new Date(), updatedAt: new Date() }),
    listWorkflows:      jest.fn().mockResolvedValue([]),
    getWorkflow:        jest.fn().mockResolvedValue({ id: 'wf-1', name: 'test', version: 1, steps: [], createdAt: new Date(), updatedAt: new Date() }),
    triggerExecution:   jest.fn().mockResolvedValue({ id: 'exec-1', status: 'COMPLETED', workflowId: 'wf-1', currentStepIndex: 0, input: {}, output: {}, error: null, startedAt: new Date(), completedAt: new Date(), createdBy: 'test-user' }),
    getExecution:       jest.fn().mockResolvedValue({ id: 'exec-1', status: 'COMPLETED', workflowId: 'wf-1', currentStepIndex: 0, input: {}, output: {}, error: null, startedAt: new Date(), completedAt: new Date(), createdBy: 'test-user' }),
    getExecutionEvents: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('API Gateway — integration', () => {

  describe('GET /health', () => {
    it('returns 200 with service info', async () => {
      const app = createApp(config, { orchestratorClient: makeOrchestrator() });
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('api-gateway');
      expect(typeof res.body.uptime).toBe('number');
    });

    it('returns X-Request-Id header on every response', async () => {
      const app = createApp(config, { orchestratorClient: makeOrchestrator() });
      const res = await request(app).get('/health');

      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Authentication', () => {
    it('returns 401 with no token', async () => {
      const app = createApp(config, { orchestratorClient: makeOrchestrator() });
      const res = await request(app).get('/workflows');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.requestId).toBeDefined();
    });

    it('returns 401 with malformed token', async () => {
      const app = createApp(config, { orchestratorClient: makeOrchestrator() });
      const res = await request(app)
        .get('/workflows')
        .set('Authorization', 'Bearer not.a.token');

      expect(res.status).toBe(401);
    });

    it('returns 401 with token signed by wrong secret', async () => {
      const app = createApp(config, { orchestratorClient: makeOrchestrator() });
      const badToken = jwt.sign({ userId: 'x' }, 'wrong-secret-here!', { expiresIn: '1h' });
      const res = await request(app)
        .get('/workflows')
        .set('Authorization', `Bearer ${badToken}`);

      expect(res.status).toBe(401);
    });

    it('accepts a valid token', async () => {
      const app = createApp(config, { orchestratorClient: makeOrchestrator() });
      const res = await request(app)
        .get('/workflows')
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /workflows', () => {
    it('returns 201 with valid workflow definition', async () => {
      const app = createApp(config, { orchestratorClient: makeOrchestrator() });
      const res = await request(app)
        .post('/workflows')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({
          name: 'test-workflow',
          steps: [{ name: 'step-one', type: 'activity', retries: 3, timeoutMs: 5000, compensation: null }],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it('returns 400 when name is missing', async () => {
      const app = createApp(config, { orchestratorClient: makeOrchestrator() });
      const res = await request(app)
        .post('/workflows')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ steps: [] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when name has invalid characters', async () => {
      const app = createApp(config, { orchestratorClient: makeOrchestrator() });
      const res = await request(app)
        .post('/workflows')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({
          name: 'Invalid Name With Spaces!',
          steps: [{ name: 'step-one', type: 'activity', retries: 3, timeoutMs: 5000, compensation: null }],
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when steps array is empty', async () => {
      const app = createApp(config, { orchestratorClient: makeOrchestrator() });
      const res = await request(app)
        .post('/workflows')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: 'test-workflow', steps: [] });

      expect(res.status).toBe(400);
    });

    it('forwards 404 from orchestrator correctly', async () => {
      const orchestrator = makeOrchestrator({
        createWorkflow: jest.fn().mockRejectedValue(new NotFoundError('Workflow')),
      });
      const app = createApp(config, { orchestratorClient: orchestrator });
      const res = await request(app)
        .post('/workflows')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({
          name: 'test-workflow',
          steps: [{ name: 'step-one', type: 'activity', retries: 3, timeoutMs: 5000, compensation: null }],
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /workflows/:id/executions', () => {
    it('returns 201 with valid trigger request', async () => {
      const app = createApp(config, { orchestratorClient: makeOrchestrator() });
      const res = await request(app)
        .post('/workflows/wf-1/executions')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ input: { orderId: 'ord-001' } });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('COMPLETED');
    });

    it('accepts empty input', async () => {
      const app = createApp(config, { orchestratorClient: makeOrchestrator() });
      const res = await request(app)
        .post('/workflows/wf-1/executions')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({});

      expect(res.status).toBe(201);
    });
  });

  describe('Error response shape', () => {
    it('every error has code, message, requestId', async () => {
      const app = createApp(config, { orchestratorClient: makeOrchestrator() });
      const res = await request(app).get('/workflows');

      expect(res.body.error).toHaveProperty('code');
      expect(res.body.error).toHaveProperty('message');
      expect(res.body.error).toHaveProperty('requestId');
    });
  });
});
