// Shared types mirroring @chronos/shared (without the workspace dep)

export interface User {
  id: string;
  email: string;
  orgId: string;
  role: 'admin' | 'member';
  createdAt: string;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: User;
}

export interface WorkflowStep {
  name: string;
  type: 'activity';
  activity: string;
  retries: number;
  timeoutMs: number;
  compensation: string | null;
}

export interface WorkflowDefinition {
  id: string;
  orgId: string;
  name: string;
  version: number;
  steps: WorkflowStep[];
  createdAt: string;
}

export interface Execution {
  id: string;
  orgId: string;
  workflowId: string;
  workflowVersion: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'COMPENSATING' | 'COMPENSATED';
  currentStepIndex: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  createdBy: string;
}

export interface DomainEvent {
  id: string;
  executionId: string;
  type: string;
  stepName: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  orgId: string;
  userId: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

// Neo4j graph types
export interface StepFailureStat {
  step: string;
  activity: string;
  failureCount: number;
}

export interface StepBottleneck {
  step: string;
  activity: string;
  avgDurationMs: number;
  maxDurationMs: number;
  executionCount: number;
}

export interface StepExecutionRecord {
  step: string;
  status: string;
  attemptNumber: number;
  durationMs: number;
  occurredAt: string;
}

export interface WorkflowMatch {
  id: string;
  name: string;
  orgId: string;
}

export interface WebhookRegistration {
  id: string;
  orgId: string;
  url: string;
  events: string[];
  secret: string | null;
  isActive: boolean;
  createdAt: string;
  lastTriggeredAt: string | null;
  failureCount: number;
}

// Notification shape pushed from notifier SSE
export interface LiveNotification {
  id: string;
  executionId: string;
  workflowId: string;
  status: string;
  orgId: string;
  occurredAt: string;
}
