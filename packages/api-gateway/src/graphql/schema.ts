export const typeDefs = /* GraphQL */ `
  scalar JSON

  type Workflow {
    id: ID!
    name: String!
    orgId: String!
    version: Int!
    steps: [WorkflowStep!]!
    createdAt: String!
  }

  type WorkflowStep {
    name: String!
    activity: String!
    compensation: String
    retries: Int!
    timeoutMs: Int!
  }

  type Execution {
    id: ID!
    workflowId: String!
    workflowVersion: Int!
    orgId: String!
    status: ExecutionStatus!
    currentStepIndex: Int!
    input: JSON
    output: JSON
    error: String
    startedAt: String!
    completedAt: String
    events: [ExecutionEvent!]!
  }

  type ExecutionEvent {
    id: ID!
    type: String!
    stepName: String
    payload: JSON
    occurredAt: String!
  }

  enum ExecutionStatus {
    PENDING
    RUNNING
    COMPENSATING
    COMPLETED
    FAILED
  }

  type WorkflowMatch {
    id: ID!
    name: String!
    orgId: String!
  }

  type StepFailureStat {
    step: String!
    activity: String!
    failureCount: Int!
  }

  type StepBottleneck {
    step: String!
    activity: String!
    avgDurationMs: Float!
    maxDurationMs: Float!
    executionCount: Int!
  }

  type StepExecutionRecord {
    step: String!
    status: String!
    attemptNumber: Int!
    durationMs: Int!
    occurredAt: String!
  }

  type ActivityImpact {
    workflowName: String!
    step: String!
    compensatedBy: String!
  }

  type Query {
    workflow(id: ID!): Workflow
    workflows: [Workflow!]!
    execution(id: ID!): Execution
    executions(status: ExecutionStatus): [Execution!]!
    workflowsByActivity(activityName: String!): [WorkflowMatch!]!
    failurePaths(orgId: String!): [StepFailureStat!]!
    bottlenecks(orgId: String!): [StepBottleneck!]!
    executionGraph(executionId: ID!): [StepExecutionRecord!]!
    activityDependencyImpact(activityName: String!): [ActivityImpact!]!
  }

  type Mutation {
    registerWorkflow(input: RegisterWorkflowInput!): Workflow!
    triggerExecution(input: TriggerExecutionInput!): Execution!
  }

  type Subscription {
    executionUpdated(executionId: ID!): Execution!
  }

  input RegisterWorkflowInput {
    name: String!
    steps: [WorkflowStepInput!]!
  }

  input WorkflowStepInput {
    name: String!
    activity: String!
    compensation: String
    retries: Int!
    timeoutMs: Int!
  }

  input TriggerExecutionInput {
    workflowId: ID!
    input: JSON
  }
`;
