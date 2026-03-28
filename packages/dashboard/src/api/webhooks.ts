import { apiClient } from './client';
import type { WebhookRegistration } from '../types';

export async function listWebhooks(): Promise<WebhookRegistration[]> {
  const { data } = await apiClient.get<WebhookRegistration[]>('/webhooks');
  return data;
}

export async function createWebhook(payload: {
  url: string;
  events: string[];
  secret?: string;
}): Promise<WebhookRegistration> {
  const { data } = await apiClient.post<WebhookRegistration>('/webhooks', payload);
  return data;
}

export async function deleteWebhook(id: string): Promise<void> {
  await apiClient.delete(`/webhooks/${id}`);
}
