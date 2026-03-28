import { apiClient } from './client';
import type { ApiKey } from '../types';

export async function listApiKeys(): Promise<ApiKey[]> {
  const { data } = await apiClient.get<ApiKey[]>('/api-keys');
  return data;
}

export async function createApiKey(name: string): Promise<{ key: ApiKey; rawKey: string }> {
  const { data } = await apiClient.post<{ key: ApiKey; rawKey: string }>('/api-keys', { name });
  return data;
}

export async function revokeApiKey(id: string): Promise<void> {
  await apiClient.delete(`/api-keys/${id}`);
}
