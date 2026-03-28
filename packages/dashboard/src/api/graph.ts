import { apiClient } from './client';
import type { StepFailureStat, StepBottleneck, StepExecutionRecord, WorkflowMatch } from '../types';

// These hit the orchestrator /internal/graph/* endpoints via the API gateway's proxy
// The gateway doesn't expose /internal — so we call via GraphQL or dedicated gateway endpoints.
// For Phase 6, graph data is fetched via the GraphQL API.

export async function failurePaths(): Promise<StepFailureStat[]> {
  const { data } = await apiClient.get<StepFailureStat[]>('/executions/graph/failure-paths');
  return data;
}

export async function bottlenecks(): Promise<StepBottleneck[]> {
  const { data } = await apiClient.get<StepBottleneck[]>('/executions/graph/bottlenecks');
  return data;
}

export async function executionGraph(executionId: string): Promise<StepExecutionRecord[]> {
  const { data } = await apiClient.get<StepExecutionRecord[]>(`/executions/${executionId}/graph`);
  return data;
}

export async function workflowsByActivity(activityName: string): Promise<WorkflowMatch[]> {
  const { data } = await apiClient.get<WorkflowMatch[]>('/workflows/by-activity', {
    params: { activity: activityName },
  });
  return data;
}
