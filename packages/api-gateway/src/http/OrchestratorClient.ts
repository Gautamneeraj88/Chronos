import axios, { AxiosInstance } from 'axios';
import {
  WorkflowDefinition,
  Execution,
  DomainEvent,
  CreateWorkflowInput,
  NotFoundError,
  InternalError,
} from '@chronos/shared';
import { IOrchestratorClient } from './IOrchestratorClient';

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

  async createWorkflow(data: CreateWorkflowInput): Promise<WorkflowDefinition> {
    const { data: res } = await this.http.post('/internal/workflows', data);
    return res;
  }

  async listWorkflows(): Promise<WorkflowDefinition[]> {
    const { data: res } = await this.http.get('/internal/workflows');
    return res;
  }

  async getWorkflow(id: string): Promise<WorkflowDefinition> {
    const { data: res } = await this.http.get(`/internal/workflows/${id}`);
    return res;
  }

  async triggerExecution(
    workflowId: string,
    input: Record<string, unknown>,
    userId: string,
  ): Promise<Execution> {
    const { data: res } = await this.http.post('/internal/executions', {
      workflowId,
      input,
      userId,
    });
    return res;
  }

  async getExecution(id: string): Promise<Execution> {
    const { data: res } = await this.http.get(`/internal/executions/${id}`);
    return res;
  }

  async getExecutionEvents(executionId: string): Promise<DomainEvent[]> {
    const { data: res } = await this.http.get(`/internal/executions/${executionId}/events`);
    return res;
  }
}
