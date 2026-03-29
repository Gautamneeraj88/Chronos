# Changelog

All notable changes to Chronos are documented here.
Versions follow [Semantic Versioning](https://semver.org/).

---

## [v0.9.0] — 2026-03-XX — Documentation + DX

- `README.md` — project overview, quick start, feature list, comparison table
- `LICENSE` — MIT
- `CONTRIBUTING.md` — PR process, commit format, issue reporting
- `CHANGELOG.md` — full history v0.1.0 through v0.9.0
- `docs/quickstart.md` — 5-minute deploy guide
- `docs/architecture.md` — saga, event sourcing, crash recovery, Kafka flow, Mermaid diagrams
- `docs/api-reference.md` — all REST + GraphQL endpoints with examples
- `docs/configuration.md` — every env var for every service
- `docs/development.md` — setup, testing, project structure, git workflow
- `docs/deployment.md` — production checklist, scaling workers, reverse proxy, backup
- `scripts/dev.sh` — single entrypoint for common dev tasks
- `scripts/health-check.sh` — verify all services are healthy
- `scripts/seed.sh` — seed sample workflows for demo
- OpenAPI spec mounted at `/docs` (swagger-ui) + `docs/openapi.json`
- GitHub issue templates (bug report, feature request) + PR template

---

## [v0.8.0] — 2026-03-XX — Docker Images + One-Command Deploy

- Multi-stage Dockerfiles for all 5 services (api-gateway, orchestrator, worker, notifier, dashboard)
- `docker-compose.prod.yml` — pulls from ghcr.io, works with Docker and Podman
- `kafka-init` service — auto-creates Kafka topics on first boot
- `scripts/docker-build-local.sh` — build all images locally, auto-detects docker vs podman
- `--format docker` flag for Podman builds (OCI format silently drops HEALTHCHECK)
- GitHub Actions CI workflow — runs tests on every PR + push to main
- GitHub Actions publish workflow — matrix builds 7 images to ghcr.io on `v*` tag push
- Custom Grafana image with pre-provisioned datasources and dashboards baked in
- Custom Prometheus image with production scrape config (uses container names, not host)
- `.dockerignore` — excludes node_modules, dist, .env files from build context
- `.env.example` — covers all production and dev variables with documentation

---

## [v0.7.0] — 2026-03-XX — Observability Stack

- Prometheus metrics on gateway (:3000/metrics), orchestrator (:3001/metrics), worker (:3002/metrics)
- Grafana with 4 pre-provisioned dashboards (Execution Overview, Step Latency, DLQ, System)
- Loki log aggregation via `winston-loki` transport — structured logs searchable in Grafana
- Jaeger distributed tracing via OpenTelemetry SDK — traces across gateway → orchestrator → worker
- Dashboard `MetricsPage` — embeds live Grafana panels in the React UI
- `infra/prometheus/prometheus.yml` — scrape config for all services
- `infra/grafana/` — provisioning YAML for datasources and dashboard JSON files
- `infra/loki/` — Loki local config

---

## [v0.6.0] — 2026-03-XX — Frontend Dashboard

- React + Vite + Tailwind CSS dashboard (`packages/dashboard`)
- JWT auth — login page, token stored in localStorage, auto-refresh before expiry
- Bootstrap admin — first user created from `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD` env vars
- Role-based access — admin/member roles, admin-only pages guarded client and server side
- Workflow list, workflow detail with step DAG visualization (React Flow)
- Execution list with status badges, execution detail with live event timeline
- GraphQL subscription — real-time execution updates pushed to the browser
- Graph Explorer — Neo4j failure paths and bottleneck visualizations
- Metrics page — embedded Grafana panels
- API key management — create, list, revoke keys
- Webhook management — register, list, delete webhooks
- `nginx.conf` — production nginx config with `/api/` proxy, lazy DNS resolution

---

## [v0.5.0] — 2026-03-XX — Neo4j Workflow DAG Queries

- `@chronos/neo4j` package — `Neo4jClient` singleton with connection pooling
- Graph model: `Workflow`, `Step`, `Activity`, `Execution` nodes + `HAS_STEP`, `NEXT`, `EXECUTED_STEP` relationships
- `WorkflowGraphService` — upserts graph nodes on workflow registration and execution events
- `GraphQueryService` — 5 Cypher queries:
  - `getFailurePaths` — most common step failure sequences
  - `getBottlenecks` — steps with highest average latency
  - `getWorkflowsByActivity` — workflows sharing an activity type
  - `getExecutionGraph` — full DAG for one execution with timing
  - `getActivityDependencies` — which activities depend on which
- `/internal/graph/*` REST endpoints on the orchestrator
- GraphQL extension — `workflowGraph`, `failurePaths`, `bottlenecks` queries

---

## [v0.4.0] — 2026-03-XX — GraphQL + RabbitMQ

- GraphQL API using `graphql-yoga` v5 — mounted at `/graphql` on the gateway
- Queries: `workflow`, `workflows`, `execution`, `executions`, `executionEvents`
- Mutations: `registerWorkflow`, `triggerExecution`, `createApiKey`, `revokeApiKey`
- Subscriptions: `executionUpdated` — real-time push via SSE
- `@chronos/rabbitmq` package — `RabbitMQClient`, `NotificationPublisher`, `NotificationConsumer`
- Topic exchange `chronos.notifications` — fanout of execution lifecycle events
- `@chronos/notifier` package — RabbitMQ consumer, webhook delivery with HMAC-SHA256 signature
- `COMPENSATION_FAILED` event type added to handle terminal compensation errors

---

## [v0.3.0] — 2026-03-XX — Production Hardening

- Retry with exponential backoff — configurable `retries` + `backoffMs` per step
- Step timeout detection — Redis sorted set tracks in-flight steps, TTL-based timeout injection
- Dead letter queue — `chronos.step.dlq` topic receives messages that exceed max retries
- Workflow versioning — `version` field on `WorkflowDefinition`, immutable after creation
- Prometheus metrics — step execution count, duration histograms, DLQ depth
- OpenTelemetry tracing — trace context propagated across gateway → orchestrator → worker
- Multi-tenancy — `orgId` scoped on every `Workflow` and `Execution`; all queries filter by org
- API key management — bcrypt-hashed keys, O(1) prefix lookup, admin-only creation

---

## [v0.2.0] — 2026-03-XX — Kafka + Distributed Workers

- `@chronos/kafka` package — `KafkaClient`, `StepPublisher`, `ResultConsumer` with consumer group
- `@chronos/worker` package — activity executor, consumes from `chronos.step.execute`, publishes to `chronos.step.result`
- Single-tick saga advance — orchestrator processes one `StepResultMessage`, advances to the next step
- `STEP_IN_FLIGHT` event — written before publishing to Kafka, used as crash recovery marker
- Idempotency guard — duplicate Kafka results (at-least-once delivery) detected and skipped
- Kafka topics: `chronos.step.execute`, `chronos.step.result`, `chronos.step.dlq` — 6 partitions each

---

## [v0.1.0] — 2026-03-XX — Core Engine

- Saga pattern — `SagaEngine` advances workflows step by step, runs compensations in reverse on failure
- Append-only event sourcing — `EventRepository` writes immutable `ExecutionEvent` documents to MongoDB
- Crash recovery — `RecoveryEngine` runs on startup, replays events to find interrupted executions and re-queues them
- Distributed locking — `RedisLockService` uses `SETNX` + Lua atomic release; prevents split-brain on multi-instance deployments
- `WorkflowRepository` + `ExecutionRepository` — MongoDB-backed, org-scoped
- JWT auth — RS256 tokens, `authMiddleware` on gateway routes
- Zod validation — all request bodies validated at the gateway boundary
- Winston logging — structured JSON logs with correlation IDs
- Express app — health endpoint, error handler, request ID middleware
