import axios, { AxiosInstance } from 'axios';
import {
  WorkflowDefinition,
  Execution,
  DomainEvent,
  CreateWorkflowInput,
  NotFoundError,
  InternalError,
} from '@chronos/shared';
import { IOrchestratorClient, ValidatedAuth } from './IOrchestratorClient';

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
}
