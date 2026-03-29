# Development Guide

## Prerequisites

- **Node.js 22** — use [fnm](https://github.com/Schniz/fnm): `fnm use` (reads `.node-version`)
- **pnpm 9+** — `npm install -g pnpm` or `corepack enable && corepack prepare pnpm@latest --activate`
- **Podman 4+** or **Docker 24+** — for running infrastructure
- **Turborepo** — installed via `pnpm install` (dev dependency at root)

## Setup

```bash
git clone https://github.com/gautamneeraj88/chronos.git
cd chronos
fnm use           # switches to Node 22
pnpm install      # installs all workspace dependencies
```

## Start infrastructure

```bash
podman-compose up -d
# Creates: MongoDB, Redis, Kafka, ZooKeeper, RabbitMQ, Neo4j, Jaeger, Prometheus, Grafana, Loki

# Create Kafka topics (only needed on first run)
bash scripts/setup-kafka-topics.sh

# Verify everything is up
bash scripts/health-check.sh
```

Or use the dev script:

```bash
bash scripts/dev.sh up
```

## Start services

Open five terminals (or use a terminal multiplexer):

```bash
# Terminal 1
cd packages/orchestrator && pnpm run dev   # :3001

# Terminal 2
cd packages/worker && pnpm run dev         # :3002

# Terminal 3
cd packages/api-gateway && pnpm run dev    # :3000

# Terminal 4
cd packages/notifier && pnpm run dev       # :3003

# Terminal 5
cd packages/dashboard && pnpm run dev      # :5173
```

## Running tests

```bash
# Unit tests — no containers needed
turbo run test

# Integration tests — requires MongoDB + Redis running
turbo run test:integration

# Single package
pnpm --filter @chronos/orchestrator test
pnpm --filter @chronos/api-gateway test:integration

# Watch mode
cd packages/orchestrator && pnpm test -- --watch
```

## Build

```bash
# Build all packages (respects dependency order)
turbo run build

# Build single package
pnpm --filter @chronos/shared build
```

## Lint

```bash
turbo run lint
# or
pnpm --filter @chronos/api-gateway lint
```

## Project structure

```
chronos/
├── packages/
│   ├── shared/           @chronos/shared
│   │   └── src/
│   │       ├── types/    WorkflowDefinition, Execution, ExecutionEvent
│   │       ├── errors/   ValidationError, NotFoundError, UnauthorizedError
│   │       └── logger/   Winston with optional Loki transport
│   │
│   ├── kafka/            @chronos/kafka
│   │   └── src/
│   │       ├── KafkaClient.ts
│   │       ├── StepPublisher.ts
│   │       └── ResultConsumer.ts
│   │
│   ├── rabbitmq/         @chronos/rabbitmq
│   │   └── src/
│   │       ├── RabbitMQClient.ts
│   │       ├── NotificationPublisher.ts
│   │       └── NotificationConsumer.ts
│   │
│   ├── neo4j/            @chronos/neo4j
│   │   └── src/
│   │       ├── Neo4jClient.ts
│   │       ├── WorkflowGraphService.ts
│   │       └── GraphQueryService.ts
│   │
│   ├── orchestrator/     @chronos/orchestrator
│   │   └── src/
│   │       ├── models/         Mongoose models
│   │       ├── repositories/   WorkflowRepository, ExecutionRepository, EventRepository
│   │       ├── services/       SagaEngine, RecoveryEngine, RedisLockService,
│   │       │                   TimeoutScanner, AuthService, ApiKeyService
│   │       ├── routes/         REST API routes + internal routes
│   │       └── config/         Zod config schema
│   │
│   ├── worker/           @chronos/worker
│   │   └── src/
│   │       ├── activities/     Activity implementations
│   │       ├── ActivityExecutor.ts
│   │       └── server.ts
│   │
│   ├── notifier/         @chronos/notifier
│   │   └── src/
│   │       ├── WebhookDeliveryService.ts
│   │       └── server.ts
│   │
│   └── dashboard/        @chronos/dashboard
│       └── src/
│           ├── components/
│           ├── pages/
│           ├── hooks/
│           └── lib/      GraphQL client, API client
│
├── infra/
│   ├── prometheus/       prometheus.yml + Dockerfile
│   ├── grafana/          provisioning/ + grafana.ini + Dockerfile
│   └── loki/             loki-config.yaml
│
├── scripts/
│   ├── dev.sh            Common dev tasks
│   ├── health-check.sh   Verify all services
│   ├── seed.sh           Seed sample workflows
│   ├── docker-build-local.sh
│   └── setup-kafka-topics.sh
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml        Tests on PR + push to main
│   │   └── publish.yml   Build + push images on v* tag
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
│
├── docker-compose.prod.yml
├── podman-compose.yml     (dev infrastructure only)
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Git workflow

```
main ─────────────────────────── production
  └── feat/phase9-docs ───────── feature branch
  └── fix/timeout-scanner ─────── fix branch
```

- Branch naming: `feat/description` or `fix/description`
- Commits: Conventional Commits format enforced by `commitlint` + `husky`
- Merge: PRs to main via GitHub
- Tags: semver `v0.x.0` per phase

## Commit scopes

```
shared, gateway, orchestrator, worker, notifier, dashboard,
kafka, rabbitmq, neo4j, docker, ci, docs, infra
```

## Common tasks

```bash
# Check all service health
bash scripts/dev.sh health

# Tail orchestrator logs
bash scripts/dev.sh logs orchestrator

# Stop infrastructure
bash scripts/dev.sh down

# Run everything fresh
bash scripts/dev.sh up
```

## Environment variables for dev

Copy and edit:

```bash
cp .env.example .env
```

The defaults in `.env.example` work for local development without changes. Only `JWT_SECRET` is enforced as required in production.

## Debugging

### Neovim (nvim-dap)

A `launch.json`-compatible config for `ts-node-dev` attach:

```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to orchestrator",
  "port": 9229,
  "restart": true,
  "sourceMaps": true,
  "outFiles": ["${workspaceFolder}/packages/orchestrator/dist/**/*.js"]
}
```

Start with: `cd packages/orchestrator && node --inspect -r ts-node/register src/server.ts`

### Kafka messages

```bash
# Consume from step.execute topic
podman exec -it chronos-kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic chronos.step.execute \
  --from-beginning
```

### MongoDB queries

```bash
podman exec -it chronos-mongodb mongosh \
  "mongodb://chronos:changeme@localhost:27017/chronos?authSource=admin"

# Check executions
db.executions.find({ status: 'RUNNING' }).pretty()
# Check events for an execution
db.executionevents.find({ executionId: ObjectId('...') }).sort({ timestamp: 1 })
```
