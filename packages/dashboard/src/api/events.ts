import { apiClient } from './client';
import type { DomainEvent } from '../types';

export async function getExecutionEvents(executionId: string): Promise<DomainEvent[]> {
  const { data } = await apiClient.get<DomainEvent[]>(`/executions/${executionId}/events`);
  return data;
}
