import axios, { AxiosInstance } from 'axios';
import {
  WorkflowDefinition,
  Execution,
  DomainEvent,
  CreateWorkflowInput,
  NotFoundError,
  InternalError,
  User,
  AuthSession,
} from '@chronos/shared';
import { IOrchestratorClient, ValidatedAuth } from './IOrchestratorClient';
import {
  WorkflowMatch,
  StepFailureStat,
  StepBottleneck,
  StepExecutionRecord,
  ActivityImpact,
} from '../graphql/graph.types';

export class OrchestratorClient implements IOrchestratorClient {
  private readonly http: AxiosInstance;

  constructor(baseURL: string) {
    this.http = axios.create({
      baseURL,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Map orchestrator HTTP errors into ChronosErrors
    // so the gateway's errorHandler handles them correctly
    this.http.interceptors.response.use(
      (res) => res,
      (err) => {
        const status = err.response?.status;
        const message = err.response?.data?.error?.message ?? err.message;

        if (status === 404) throw new NotFoundError(message);
        throw new InternalError(message ?? `orchestrator error: ${status}`);
      },
    );
  }

  async validateApiKey(rawKey: string): Promise<ValidatedAuth | null> {
    try {
      const { data: res } = await this.http.post('/internal/auth/validate-key', { key: rawKey });
      return res;
    } catch {
      return null;
    }
  }

  async createWorkflow(data: CreateWorkflowInput, orgId: string): Promise<WorkflowDefinition> {
    const { data: res } = await this.http.post('/internal/workflows', data, {
      headers: { 'X-Org-Id': orgId },
    });
    return res;
  }

  async listWorkflows(orgId: string): Promise<WorkflowDefinition[]> {
    const { data: res } = await this.http.get('/internal/workflows', {
      headers: { 'X-Org-Id': orgId },
    });
    return res;
  }

  async getWorkflow(id: string, orgId: string): Promise<WorkflowDefinition> {
    const { data: res } = await this.http.get(`/internal/workflows/${id}`, {
      headers: { 'X-Org-Id': orgId },
    });
    return res;
  }

  async triggerExecution(
    workflowId: string,
    input: Record<string, unknown>,
    userId: string,
    orgId: string,
  ): Promise<Execution> {
    const { data: res } = await this.http.post(
      '/internal/executions',
      { workflowId, input, userId },
      { headers: { 'X-Org-Id': orgId } },
    );
    return res;
  }

  async getExecution(id: string, orgId: string): Promise<Execution> {
    const { data: res } = await this.http.get(`/internal/executions/${id}`, {
      headers: { 'X-Org-Id': orgId },
    });
    return res;
  }

  async getExecutionEvents(executionId: string, orgId: string): Promise<DomainEvent[]> {
    const { data: res } = await this.http.get(`/internal/executions/${executionId}/events`, {
      headers: { 'X-Org-Id': orgId },
    });
    return res;
  }

  async listExecutions(orgId: string, status?: string): Promise<Execution[]> {
    const params = status ? { status } : {};
    const { data: res } = await this.http.get('/internal/executions', {
      headers: { 'X-Org-Id': orgId },
      params,
    });
    return res;
  }

  async workflowsByActivity(activityName: string, orgId: string): Promise<WorkflowMatch[]> {
    const { data: res } = await this.http.get('/internal/graph/workflows-by-activity', {
      headers: { 'X-Org-Id': orgId },
      params: { activity: activityName },
    });
    return res;
  }

  async failurePaths(orgId: string): Promise<StepFailureStat[]> {
    const { data: res } = await this.http.get('/internal/graph/failure-paths', {
      headers: { 'X-Org-Id': orgId },
      params: { orgId },
    });
    return res;
  }

  async bottlenecks(orgId: string): Promise<StepBottleneck[]> {
    const { data: res } = await this.http.get('/internal/graph/bottlenecks', {
      headers: { 'X-Org-Id': orgId },
      params: { orgId },
    });
    return res;
  }

  async executionGraph(executionId: string, orgId: string): Promise<StepExecutionRecord[]> {
    const { data: res } = await this.http.get(`/internal/graph/execution/${executionId}`, {
      headers: { 'X-Org-Id': orgId },
    });
    return res;
  }

  async activityDependencyImpact(activityName: string, orgId: string): Promise<ActivityImpact[]> {
    const { data: res } = await this.http.get('/internal/graph/activity-impact', {
      headers: { 'X-Org-Id': orgId },
      params: { activity: activityName },
    });
    return res;
  }

  // ── Auth methods ──────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<AuthSession | null> {
    try {
      const { data: res } = await this.http.post('/internal/auth/login', { email, password });
      return res;
    } catch {
      return null;
    }
  }

  async me(token: string): Promise<User> {
    const { data: res } = await this.http.get('/internal/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.user;
  }

  async refresh(token: string): Promise<AuthSession> {
    const { data: res } = await this.http.post(
      '/internal/auth/refresh',
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return res;
  }

  async register(
    email: string,
    password: string,
    role: string,
    orgId: string,
    token: string,
  ): Promise<User> {
    const { data: res } = await this.http.post(
      '/internal/auth/register',
      { email, password, role },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Org-Id': orgId,
        },
      },
    );
    return res.user;
  }

  async listUsers(orgId: string, token: string): Promise<User[]> {
    const { data: res } = await this.http.get('/internal/auth/users', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Org-Id': orgId,
      },
    });
    return res.users;
  }

  async deleteUser(id: string, token: string): Promise<void> {
    await this.http.delete(`/internal/auth/users/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // ── API key management ─────────────────────────────────────────────────────

  async listApiKeys(orgId: string): Promise<import('./IOrchestratorClient').ApiKeySummary[]> {
    const { data: res } = await this.http.get('/internal/api-keys', {
      headers: { 'X-Org-Id': orgId },
    });
    return res;
  }

  async createApiKey(
    orgId: string,
    userId: string,
    name: string,
  ): Promise<{ key: import('./IOrchestratorClient').ApiKeySummary; rawKey: string }> {
    const { data: res } = await this.http.post(
      '/internal/api-keys',
      { name, userId },
      { headers: { 'X-Org-Id': orgId } },
    );
    return res;
  }

  async revokeApiKey(id: string, orgId: string): Promise<void> {
    await this.http.delete(`/internal/api-keys/${id}`, {
      headers: { 'X-Org-Id': orgId },
    });
  }

  // ── Webhook management ────────────────────────────────────────────────────

  async listWebhooks(orgId: string): Promise<import('./IOrchestratorClient').WebhookSummary[]> {
    const { data: res } = await this.http.get('/internal/webhooks', {
      headers: { 'X-Org-Id': orgId },
    });
    return res;
  }

  async createWebhook(
    orgId: string,
    payload: { url: string; events: string[]; secret?: string },
  ): Promise<import('./IOrchestratorClient').WebhookSummary> {
    const { data: res } = await this.http.post('/internal/webhooks', payload, {
      headers: { 'X-Org-Id': orgId },
    });
    return res;
  }

  async deleteWebhook(id: string, orgId: string): Promise<void> {
    await this.http.delete(`/internal/webhooks/${id}`, {
      headers: { 'X-Org-Id': orgId },
    });
  }
}
