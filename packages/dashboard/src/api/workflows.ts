import { apiClient } from './client';
import type { WorkflowDefinition } from '../types';

export async function listWorkflows(): Promise<WorkflowDefinition[]> {
  const { data } = await apiClient.get<WorkflowDefinition[]>('/workflows');
  return data;
}

export async function getWorkflow(id: string): Promise<WorkflowDefinition> {
  const { data } = await apiClient.get<WorkflowDefinition>(`/workflows/${id}`);
  return data;
}

export async function createWorkflow(
  payload: { name: string; steps: WorkflowDefinition['steps'] },
): Promise<WorkflowDefinition> {
  const { data } = await apiClient.post<WorkflowDefinition>('/workflows', payload);
  return data;
}
