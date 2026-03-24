import request from 'supertest';
import { Express } from 'express';
import { buildTestApp, cleanDatabase, teardown, sampleWorkflow, TEST_ORG_ID } from './helpers';

// Requires podman containers: podman-compose up -d

let app: Express;

beforeAll(async () => {
  app = await buildTestApp();
}, 30_000);

afterEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await teardown();
});

// Helper: adds X-Org-Id header to every request
const orgHeader = { 'X-Org-Id': TEST_ORG_ID };

// ── Workflow registration ──────────────────────────────────────────────────

describe('POST /internal/workflows', () => {
  it('registers a workflow and returns 201', async () => {
    const res = await request(app)
      .post('/internal/workflows')
      .set(orgHeader)
      .send(sampleWorkflow);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.orgId).toBe(TEST_ORG_ID);
    expect(res.body.name).toBe('test-order-processing');
    expect(res.body.steps).toHaveLength(3);
    expect(res.body.version).toBe(1);
  });

  it('returns 409 when workflow name already exists', async () => {
    await request(app).post('/internal/workflows').set(orgHeader).send(sampleWorkflow);
    const res = await request(app).post('/internal/workflows').set(orgHeader).send(sampleWorkflow);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 400 when steps array is empty', async () => {
    const res = await request(app)
      .post('/internal/workflows')
      .set(orgHeader)
      .send({ name: 'empty-steps', steps: [] });

    expect(res.status).toBe(400);
  });

  it('returns 400 when step name has uppercase letters', async () => {
    const res = await request(app)
      .post('/internal/workflows')
      .set(orgHeader)
      .send({
        name: 'bad-workflow',
        steps: [{ name: 'BadStep', type: 'activity', retries: 3, timeoutMs: 5000, compensation: null }],
      });

    expect(res.status).toBe(400);
  });

  it('does not return workflows belonging to a different org', async () => {
    // Register under TEST_ORG_ID
    await request(app).post('/internal/workflows').set(orgHeader).send(sampleWorkflow);

    // List under a different org
    const res = await request(app)
      .get('/internal/workflows')
      .set({ 'X-Org-Id': 'other-org' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

// ── Execution ──────────────────────────────────────────────────────────────

describe('POST /internal/executions', () => {
  it('runs a workflow to COMPLETED and returns full result', async () => {
    const wfRes = await request(app).post('/internal/workflows').set(orgHeader).send(sampleWorkflow);
    const workflowId = wfRes.body.id;

    const execRes = await request(app)
      .post('/internal/executions')
      .set(orgHeader)
      .send({ workflowId, input: { orderId: 'ord-001' }, userId: 'test-user' });

    expect(execRes.status).toBe(201);
    expect(execRes.body.status).toBe('COMPLETED');
    expect(execRes.body.orgId).toBe(TEST_ORG_ID);
    expect(execRes.body.output['charge-card']).toBeDefined();
    expect(execRes.body.output['update-inventory']).toBeDefined();
    expect(execRes.body.output['send-confirmation']).toBeDefined();
    expect(execRes.body.completedAt).toBeDefined();
    expect(execRes.body.error).toBeNull();
  });

  it('returns 404 for unknown workflowId', async () => {
    const res = await request(app)
      .post('/internal/executions')
      .set(orgHeader)
      .send({ workflowId: 'non-existent-id', input: {}, userId: 'test-user' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when workflowId is missing', async () => {
    const res = await request(app)
      .post('/internal/executions')
      .set(orgHeader)
      .send({ input: {} });

    expect(res.status).toBe(400);
  });
});

// ── Event log ──────────────────────────────────────────────────────────────

describe('GET /internal/executions/:id/events', () => {
  it('returns events in chronological order', async () => {
    const wfRes = await request(app).post('/internal/workflows').set(orgHeader).send(sampleWorkflow);
    const execRes = await request(app)
      .post('/internal/executions')
      .set(orgHeader)
      .send({ workflowId: wfRes.body.id, input: {}, userId: 'test-user' });

    const eventsRes = await request(app)
      .get(`/internal/executions/${execRes.body.id}/events`);

    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body).toHaveLength(11);
    expect(eventsRes.body[0].type).toBe('EXECUTION_STARTED');
    expect(eventsRes.body[eventsRes.body.length - 1].type).toBe('EXECUTION_COMPLETED');
  });

  it('each step completes exactly once — no duplicates', async () => {
    const wfRes = await request(app).post('/internal/workflows').set(orgHeader).send(sampleWorkflow);
    const execRes = await request(app)
      .post('/internal/executions')
      .set(orgHeader)
      .send({ workflowId: wfRes.body.id, input: {}, userId: 'test-user' });

    const eventsRes = await request(app)
      .get(`/internal/executions/${execRes.body.id}/events`);

    const completions: Record<string, number> = {};
    for (const e of eventsRes.body) {
      if (e.type === 'STEP_COMPLETED') {
        completions[e.stepName] = (completions[e.stepName] ?? 0) + 1;
      }
    }

    expect(completions['charge-card']).toBe(1);
    expect(completions['update-inventory']).toBe(1);
    expect(completions['send-confirmation']).toBe(1);
  });
});

// ── Compensation path ──────────────────────────────────────────────────────

describe('Compensation path', () => {
  it('returns FAILED status when MOCK_FAIL_STEPS forces first step to fail', async () => {
    process.env.MOCK_FAIL_STEPS = 'charge-card';

    const wfRes = await request(app).post('/internal/workflows').set(orgHeader).send(sampleWorkflow);
    const execRes = await request(app)
      .post('/internal/executions')
      .set(orgHeader)
      .send({ workflowId: wfRes.body.id, input: {}, userId: 'test-user' });

    delete process.env.MOCK_FAIL_STEPS;

    expect(execRes.body.status).toBe('FAILED');
    expect(execRes.body.error).toBeDefined();
    expect(execRes.body.completedAt).toBeDefined();
  });
});

// ── Retry path ─────────────────────────────────────────────────────────────

describe('Retry path', () => {
  it('retry succeeds on second attempt → COMPLETED', async () => {
    // MOCK_FAIL_ATTEMPTS=charge-card:1 makes charge-card fail on its first call only;
    // the loopback publisher retries inline with attemptNumber+1 → succeeds on attempt 2
    process.env.MOCK_FAIL_ATTEMPTS = 'charge-card:1';

    const wfRes = await request(app).post('/internal/workflows').set(orgHeader).send(sampleWorkflow);
    const execRes = await request(app)
      .post('/internal/executions')
      .set(orgHeader)
      .send({ workflowId: wfRes.body.id, input: {}, userId: 'test-user' });

    delete process.env.MOCK_FAIL_ATTEMPTS;

    expect(execRes.body.status).toBe('COMPLETED');
    expect(execRes.body.output['charge-card']).toBeDefined();
  });

  it('max retries exceeded → FAILED', async () => {
    // Use retries:1 so only 2 total attempts; MOCK_FAIL_STEPS makes every attempt fail
    process.env.MOCK_FAIL_STEPS = 'charge-card';

    const wfRes = await request(app)
      .post('/internal/workflows')
      .set(orgHeader)
      .send({
        name: 'low-retry-workflow',
        steps: [
          { name: 'charge-card', type: 'activity', activity: 'chargeCard', retries: 1, timeoutMs: 5000, compensation: null },
        ],
      });
    const execRes = await request(app)
      .post('/internal/executions')
      .set(orgHeader)
      .send({ workflowId: wfRes.body.id, input: {}, userId: 'test-user' });

    delete process.env.MOCK_FAIL_STEPS;

    expect(execRes.body.status).toBe('FAILED');
    expect(execRes.body.error).toBeDefined();
    expect(execRes.body.completedAt).toBeDefined();
  });
});
