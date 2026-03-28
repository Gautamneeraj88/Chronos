export const WORKFLOWS_QUERY = `
  query Workflows {
    workflows {
      id name version orgId createdAt
      steps { name type activity retries timeoutMs compensation }
    }
  }
`;

export const WORKFLOW_QUERY = `
  query Workflow($id: ID!) {
    workflow(id: $id) {
      id name version orgId createdAt
      steps { name type activity retries timeoutMs compensation }
    }
  }
`;

export const EXECUTIONS_QUERY = `
  query Executions {
    executions {
      id workflowId status currentStepIndex startedAt completedAt error createdBy
    }
  }
`;

export const EXECUTION_QUERY = `
  query Execution($id: ID!) {
    execution(id: $id) {
      id workflowId workflowVersion status currentStepIndex
      input output error startedAt completedAt createdBy
      events { id type stepName payload occurredAt }
    }
  }
`;

export const EXECUTION_SUBSCRIPTION = `
  subscription ExecutionUpdated($id: ID!) {
    executionUpdated(id: $id) {
      id status completedAt error
    }
  }
`;

export const FAILURE_PATHS_QUERY = `
  query FailurePaths($orgId: String!) {
    failurePaths(orgId: $orgId) {
      step activity failureCount
    }
  }
`;

export const BOTTLENECKS_QUERY = `
  query Bottlenecks($orgId: String!) {
    bottlenecks(orgId: $orgId) {
      step activity avgDurationMs maxDurationMs executionCount
    }
  }
`;

export const EXECUTION_GRAPH_QUERY = `
  query ExecutionGraph($executionId: ID!) {
    executionGraph(executionId: $executionId) {
      step status attemptNumber durationMs occurredAt
    }
  }
`;

export const WORKFLOWS_BY_ACTIVITY_QUERY = `
  query WorkflowsByActivity($activityName: String!) {
    workflowsByActivity(activityName: $activityName) {
      id name orgId
    }
  }
`;

export const TRIGGER_EXECUTION_MUTATION = `
  mutation TriggerExecution($workflowId: ID!, $input: JSON!) {
    triggerExecution(workflowId: $workflowId, input: $input) {
      id status startedAt
    }
  }
`;

export const CREATE_WORKFLOW_MUTATION = `
  mutation CreateWorkflow($input: CreateWorkflowInput!) {
    createWorkflow(input: $input) {
      id name version createdAt
    }
  }
`;
