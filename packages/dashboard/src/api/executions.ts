import { apiClient } from './client';
import type { Execution, DomainEvent } from '../types';

export async function listExecutions(status?: string): Promise<Execution[]> {
  const { data } = await apiClient.get<Execution[]>('/executions', {
    params: status ? { status } : {},
  });
  return data;
}

export async function getExecution(id: string): Promise<Execution> {
  const { data } = await apiClient.get<Execution>(`/executions/${id}`);
  return data;
}

export async function getExecutionEvents(id: string): Promise<DomainEvent[]> {
  const { data } = await apiClient.get<DomainEvent[]>(`/executions/${id}/events`);
  return data;
}

export async function triggerExecution(
  workflowId: string,
  input: Record<string, unknown>,
): Promise<Execution> {
  const { data } = await apiClient.post<Execution>('/executions', { workflowId, input });
  return data;
}
