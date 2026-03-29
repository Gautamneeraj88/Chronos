# API Reference

Base URL: `http://localhost:3000` (development) or your gateway host.

Interactive docs: **http://localhost:3000/docs** (Swagger UI)

All authenticated endpoints require one of:
- `Authorization: Bearer <jwt>` — obtained from `POST /auth/login`
- `Authorization: Bearer <api-key>` — created in the dashboard or via `POST /api-keys`

---

## Authentication

### `POST /auth/login`

Exchange email + password for a JWT. No auth required.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "your-password"
}
```

**Response `200`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "email": "admin@example.com",
    "role": "admin",
    "orgId": "default-org"
  }
}
```

**Errors:** `400` missing fields, `401` invalid credentials

---

### `GET /auth/me`

Return the current user from the JWT. Auth required.

**Response `200`:**
```json
{
  "user": {
    "id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "email": "admin@example.com",
    "role": "admin",
    "orgId": "default-org"
  }
}
```

---

### `POST /auth/refresh`

Return a new token before the current one expires. Auth required.

**Response `200`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### `POST /auth/register`

Create a new user. Admin only.

**Request:**
```json
{
  "email": "dev@example.com",
  "password": "secure-password",
  "role": "member"
}
```

**Response `201`:**
```json
{
  "user": {
    "id": "64f1a2b3c4d5e6f7a8b9c0d2",
    "email": "dev@example.com",
    "role": "member",
    "orgId": "default-org"
  }
}
```

---

### `GET /auth/users`

List all users in the org. Admin only.

**Response `200`:**
```json
{
  "users": [
    { "id": "...", "email": "admin@example.com", "role": "admin" },
    { "id": "...", "email": "dev@example.com", "role": "member" }
  ]
}
```

---

### `DELETE /auth/users/:id`

Delete a user by ID. Admin only.

**Response `204`:** No content.

---

## Workflows

### `POST /workflows`

Register a new workflow definition. Auth required.

**Request:**
```json
{
  "name": "order-processing",
  "steps": [
    {
      "name": "charge-card",
      "activity": "chargeCard",
      "compensation": "refund-card",
      "retries": 3,
      "backoffMs": 1000,
      "timeoutMs": 10000
    },
    {
      "name": "update-inventory",
      "activity": "updateInventory",
      "compensation": "restore-inventory",
      "retries": 3,
      "backoffMs": 1000,
      "timeoutMs": 10000
    },
    {
      "name": "send-confirmation",
      "activity": "sendConfirmation",
      "compensation": null,
      "retries": 2,
      "backoffMs": 500,
      "timeoutMs": 5000
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Unique workflow name within the org |
| `steps` | array | yes | Ordered list of steps |
| `steps[].name` | string | yes | Step identifier |
| `steps[].activity` | string | yes | Activity type the worker executes |
| `steps[].compensation` | string \| null | no | Name of the step to run when rolling back |
| `steps[].retries` | number | no | Max retry attempts (default: 0) |
| `steps[].backoffMs` | number | no | Base backoff for exponential retry (default: 1000) |
| `steps[].timeoutMs` | number | no | Step timeout in ms (default: 30000) |

**Response `201`:**
```json
{
  "id": "64f1a2b3c4d5e6f7a8b9c0d3",
  "name": "order-processing",
  "version": 1,
  "orgId": "default-org",
  "steps": [...],
  "createdAt": "2026-03-28T10:00:00.000Z"
}
```

---

### `GET /workflows`

List all workflow definitions for the authenticated org. Auth required.

**Response `200`:**
```json
[
  { "id": "...", "name": "order-processing", "version": 1, "createdAt": "..." },
  { "id": "...", "name": "user-onboarding", "version": 2, "createdAt": "..." }
]
```

---

### `GET /workflows/:id`

Get a workflow definition by ID. Auth required.

**Response `200`:** Full workflow object (same as POST response).

**Errors:** `404` not found.

---

### `POST /workflows/:id/executions`

Trigger an execution for a specific workflow. Auth required.

**Request:**
```json
{
  "input": {
    "orderId": "ORD-001",
    "amount": 99.99
  }
}
```

**Response `201`:**
```json
{
  "id": "64f1a2b3c4d5e6f7a8b9c0d4",
  "workflowId": "64f1a2b3c4d5e6f7a8b9c0d3",
  "status": "RUNNING",
  "input": { "orderId": "ORD-001", "amount": 99.99 },
  "triggeredBy": "64f1a2b3c4d5e6f7a8b9c0d1",
  "orgId": "default-org",
  "startedAt": "2026-03-28T10:00:01.000Z"
}
```

---

## Executions

### `GET /executions`

List executions for the org. Auth required.

**Query params:**
- `status` — filter by status: `RUNNING`, `COMPLETED`, `COMPENSATING`, `COMPENSATED`, `COMPENSATION_FAILED`

**Response `200`:** Array of execution objects.

---

### `POST /executions`

Trigger an execution by `workflowId` in the request body. Auth required.

**Request:**
```json
{
  "workflowId": "64f1a2b3c4d5e6f7a8b9c0d3",
  "input": { "orderId": "ORD-002" }
}
```

**Response `201`:** Execution object.

---

### `GET /executions/:id`

Get execution status and current step. Auth required.

**Response `200`:**
```json
{
  "id": "64f1a2b3c4d5e6f7a8b9c0d4",
  "workflowId": "64f1a2b3c4d5e6f7a8b9c0d3",
  "status": "COMPLETED",
  "currentStepIndex": 2,
  "input": { "orderId": "ORD-001" },
  "output": { "confirmationId": "CONF-001" },
  "startedAt": "2026-03-28T10:00:01.000Z",
  "completedAt": "2026-03-28T10:00:05.000Z"
}
```

---

### `GET /executions/:id/events`

Get the full append-only event log for an execution. Auth required.

**Response `200`:**
```json
[
  { "type": "EXECUTION_STARTED", "timestamp": "...", "data": { "input": {...} } },
  { "type": "STEP_STARTED", "timestamp": "...", "data": { "stepId": "charge-card" } },
  { "type": "STEP_IN_FLIGHT", "timestamp": "...", "data": { "stepId": "charge-card" } },
  { "type": "STEP_COMPLETED", "timestamp": "...", "data": { "stepId": "charge-card", "output": {...} } },
  { "type": "STEP_STARTED", "timestamp": "...", "data": { "stepId": "update-inventory" } },
  ...
  { "type": "EXECUTION_COMPLETED", "timestamp": "...", "data": { "output": {...} } }
]
```

Event types: `EXECUTION_STARTED`, `STEP_STARTED`, `STEP_IN_FLIGHT`, `STEP_COMPLETED`, `STEP_FAILED`, `EXECUTION_COMPLETED`, `COMPENSATION_STARTED`, `STEP_COMPENSATED`, `EXECUTION_COMPENSATED`, `COMPENSATION_FAILED`

---

## API Keys

### `GET /api-keys`

List all API keys for the org. Auth required.

**Response `200`:**
```json
[
  {
    "id": "64f1a2b3c4d5e6f7a8b9c0d5",
    "name": "ci-pipeline",
    "prefix": "ck_abc123",
    "createdAt": "2026-03-28T10:00:00.000Z"
  }
]
```

Note: the full key is only shown once at creation time.

---

### `POST /api-keys`

Create a new API key. Admin only.

**Request:**
```json
{ "name": "ci-pipeline" }
```

**Response `201`:**
```json
{
  "id": "64f1a2b3c4d5e6f7a8b9c0d5",
  "name": "ci-pipeline",
  "key": "ck_abc123def456...",
  "prefix": "ck_abc123"
}
```

The `key` field is only present in this response. Store it securely — it cannot be retrieved again.

---

### `DELETE /api-keys/:id`

Revoke an API key by ID. Admin only.

**Response `204`:** No content.

---

## Webhooks

### `GET /webhooks`

List all webhooks for the org. Auth required.

**Response `200`:**
```json
[
  {
    "id": "64f1a2b3c4d5e6f7a8b9c0d6",
    "url": "https://example.com/hooks/chronos",
    "events": ["execution.completed", "execution.compensated"],
    "createdAt": "2026-03-28T10:00:00.000Z"
  }
]
```

---

### `POST /webhooks`

Register a new webhook. Auth required.

**Request:**
```json
{
  "url": "https://example.com/hooks/chronos",
  "events": ["execution.completed", "execution.compensated", "step.failed"],
  "secret": "your-hmac-secret"
}
```

Available events: `execution.started`, `execution.completed`, `execution.compensated`, `execution.failed`, `step.completed`, `step.failed`

Payload is signed with `X-Chronos-Signature: sha256={hmac}` if `secret` is provided.

**Response `201`:** Webhook object.

---

### `DELETE /webhooks/:id`

Remove a webhook. Auth required.

**Response `204`:** No content.

---

## GraphQL

Endpoint: `POST /graphql` (also used for subscriptions via SSE)

Interactive playground: `http://localhost:3000/graphql`

### Queries

```graphql
# Get a single workflow
query {
  workflow(id: "64f1a2b3c4d5e6f7a8b9c0d3") {
    id
    name
    version
    steps { name activity retries timeoutMs }
  }
}

# List all workflows
query {
  workflows {
    id
    name
    version
    createdAt
  }
}

# Get an execution
query {
  execution(id: "64f1a2b3c4d5e6f7a8b9c0d4") {
    id
    status
    currentStepIndex
    startedAt
    completedAt
  }
}

# List executions (optional status filter)
query {
  executions(status: RUNNING) {
    id
    workflowId
    status
    startedAt
  }
}

# Get full event log
query {
  executionEvents(executionId: "64f1a2b3c4d5e6f7a8b9c0d4") {
    type
    timestamp
    data
  }
}

# Neo4j graph queries
query {
  failurePaths(orgId: "default-org") {
    path
    count
  }
  bottlenecks(orgId: "default-org") {
    stepName
    avgDurationMs
    executionCount
  }
}
```

### Mutations

```graphql
# Register a workflow
mutation {
  registerWorkflow(input: {
    name: "order-processing"
    steps: [
      { name: "charge-card", activity: "chargeCard", retries: 3, timeoutMs: 10000 }
    ]
  }) {
    id
    name
    version
  }
}

# Trigger an execution
mutation {
  triggerExecution(workflowId: "64f1a2b3c4d5e6f7a8b9c0d3", input: { orderId: "ORD-001" }) {
    id
    status
    startedAt
  }
}

# Create an API key (admin only)
mutation {
  createApiKey(name: "ci-pipeline") {
    id
    key
    prefix
  }
}

# Revoke an API key (admin only)
mutation {
  revokeApiKey(id: "64f1a2b3c4d5e6f7a8b9c0d5")
}
```

### Subscriptions

```graphql
# Real-time execution updates — pushed via SSE
subscription {
  executionUpdated(executionId: "64f1a2b3c4d5e6f7a8b9c0d4") {
    id
    status
    currentStepIndex
    updatedAt
  }
}
```

---

## Health

### `GET /health`

No auth required. Returns `200` when the gateway is up.

```json
{ "status": "ok", "timestamp": "2026-03-28T10:00:00.000Z" }
```

---

## Metrics

### `GET /metrics`

Prometheus metrics endpoint. No auth required (scrape internally only — do not expose publicly).

Returns Prometheus text format with metrics:
- `http_requests_total` — labelled by method, route, status
- `http_request_duration_ms` — labelled by method, route
- `saga_steps_total` — labelled by activity, status
- `saga_step_duration_ms` — labelled by activity
- `dlq_messages_total` — labelled by activity
