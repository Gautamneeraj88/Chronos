import { apiClient } from './client';
import type { AuthSession, User } from '../types';

export async function login(email: string, password: string): Promise<AuthSession> {
  const { data } = await apiClient.post<AuthSession>('/auth/login', { email, password });
  return data;
}

export async function me(): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>('/auth/me');
  return data.user;
}

export async function refresh(): Promise<AuthSession> {
  const { data } = await apiClient.post<AuthSession>('/auth/refresh');
  return data;
}

export async function registerUser(
  email: string,
  password: string,
  role: 'admin' | 'member',
): Promise<User> {
  const { data } = await apiClient.post<{ user: User }>('/auth/register', { email, password, role });
  return data.user;
}

export async function listUsers(): Promise<User[]> {
  const { data } = await apiClient.get<{ users: User[] }>('/auth/users');
  return data.users;
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/auth/users/${id}`);
}
