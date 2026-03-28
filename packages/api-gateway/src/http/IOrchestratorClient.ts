import { WorkflowDefinition, Execution, DomainEvent, CreateWorkflowInput, User, AuthSession } from '@chronos/shared';
import {
  WorkflowMatch,
  StepFailureStat,
  StepBottleneck,
  StepExecutionRecord,
  ActivityImpact,
} from '../graphql/graph.types';

export interface ValidatedAuth {
  orgId: string;
  userId: string;
}

// Interface - what routes depend on
// This is what you mock in tests
export interface IOrchestratorClient {
  validateApiKey(rawKey: string): Promise<ValidatedAuth | null>;
  createWorkflow(data: CreateWorkflowInput, orgId: string): Promise<WorkflowDefinition>;
  listWorkflows(orgId: string): Promise<WorkflowDefinition[]>;
  getWorkflow(id: string, orgId: string): Promise<WorkflowDefinition>;
  triggerExecution(
    workflowId: string,
    input: Record<string, unknown>,
    userId: string,
    orgId: string,
  ): Promise<Execution>;
  getExecution(id: string, orgId: string): Promise<Execution>;
  getExecutionEvents(executionId: string, orgId: string): Promise<DomainEvent[]>;
  listExecutions(orgId: string, status?: string): Promise<Execution[]>;
  workflowsByActivity(activityName: string, orgId: string): Promise<WorkflowMatch[]>;
  failurePaths(orgId: string): Promise<StepFailureStat[]>;
  bottlenecks(orgId: string): Promise<StepBottleneck[]>;
  executionGraph(executionId: string, orgId: string): Promise<StepExecutionRecord[]>;
  activityDependencyImpact(activityName: string, orgId: string): Promise<ActivityImpact[]>;
  // Auth methods
  login(email: string, password: string): Promise<AuthSession | null>;
  me(token: string): Promise<User>;
  refresh(token: string): Promise<AuthSession>;
  register(email: string, password: string, role: string, orgId: string, token: string): Promise<User>;
  listUsers(orgId: string, token: string): Promise<User[]>;
  deleteUser(id: string, token: string): Promise<void>;
  // API key management
  listApiKeys(orgId: string): Promise<ApiKeySummary[]>;
  createApiKey(orgId: string, userId: string, name: string): Promise<{ key: ApiKeySummary; rawKey: string }>;
  revokeApiKey(id: string, orgId: string): Promise<void>;
  // Webhook management
  listWebhooks(orgId: string): Promise<WebhookSummary[]>;
  createWebhook(orgId: string, payload: { url: string; events: string[]; secret?: string }): Promise<WebhookSummary>;
  deleteWebhook(id: string, orgId: string): Promise<void>;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  orgId: string;
  userId: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface WebhookSummary {
  id: string;
  orgId: string;
  url: string;
  events: string[];
  secret: string | null;
  isActive: boolean;
  failureCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
}
