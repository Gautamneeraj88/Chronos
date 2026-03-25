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
}
