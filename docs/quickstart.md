# Quick Start

## Prerequisites

- Docker 24+ and Docker Compose v2, **or** Podman 4+ and podman-compose 1.1+
- 4 GB RAM minimum (8 GB recommended with all observability services running)
- Ports available: 3000, 3001, 3002, 3003, 8080, 3004, 9090, 9092, 6379, 27017

## Deploy

```bash
# 1. Download the compose file and environment template
curl -O https://raw.githubusercontent.com/gautamneeraj88/chronos/main/docker-compose.prod.yml
curl -O https://raw.githubusercontent.com/gautamneeraj88/chronos/main/.env.example
cp .env.example .env
```

```bash
# 2. Set required values in .env
#    Open .env in your editor and set at minimum:
#      JWT_SECRET              — random string, at least 32 characters
#      BOOTSTRAP_ADMIN_EMAIL   — your admin email
#      BOOTSTRAP_ADMIN_PASSWORD — your admin password
#    Change all passwords from 'changeme' before exposing to the internet.
```

```bash
# 3. Start the full stack
docker compose -f docker-compose.prod.yml up -d
# or with Podman:
podman-compose -f docker-compose.prod.yml up -d
```

```bash
# 4. Check service health (takes ~60s on first boot while Kafka initialises)
docker compose -f docker-compose.prod.yml ps
```

```bash
# 5. Open the dashboard
open http://localhost:8080
```

## First steps

1. **Login** — use `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD`
2. **Register a workflow** — go to Workflows → New Workflow, define your steps
3. **Trigger an execution** — click Trigger on any workflow row
4. **Watch it run** — open the execution detail page for the live event timeline
5. **Create an API key** — go to Settings → API Keys for programmatic access

## Service URLs

| Service | URL | Notes |
|---------|-----|-------|
| Dashboard | http://localhost:8080 | Main UI |
| API Gateway | http://localhost:3000 | REST + GraphQL |
| GraphQL Playground | http://localhost:3000/graphql | Interactive query editor |
| OpenAPI Docs | http://localhost:3000/docs | Swagger UI |
| Grafana | http://localhost:3004 | Metrics dashboards (admin/admin) |
| Prometheus | http://localhost:9090 | Raw metrics |
| Jaeger | http://localhost:16686 | Distributed traces |
| RabbitMQ | http://localhost:15672 | Queue management (chronos/changeme) |
| Neo4j Browser | http://localhost:7474 | Graph explorer (neo4j/changeme) |

## Verify the stack is healthy

```bash
bash scripts/health-check.sh
```

Expected output:

```
Checking Chronos services...
✅ API Gateway
✅ Orchestrator
✅ Worker
✅ Notifier
✅ Dashboard
✅ Prometheus
✅ Grafana
✅ Loki
✅ Jaeger
```

## Seed sample workflows

```bash
# Create an API key in the dashboard first, then:
API_KEY=ck_your_key bash scripts/seed.sh
```

This creates an `order-processing` workflow with three steps (charge-card → update-inventory → send-confirmation) and their compensating actions.

## Stopping

```bash
docker compose -f docker-compose.prod.yml down
# To also delete all data volumes:
docker compose -f docker-compose.prod.yml down -v
```

## Troubleshooting

**Services not healthy after 90 seconds**

Kafka takes the longest to initialise. Check its logs:

```bash
docker compose -f docker-compose.prod.yml logs kafka
docker compose -f docker-compose.prod.yml logs kafka-init
```

**`JWT_SECRET is required` error on startup**

The compose file uses `${JWT_SECRET:?JWT_SECRET is required}` — the stack will not start without this variable set in `.env`.

**Port conflicts**

If a port is already in use, change the host port in `docker-compose.prod.yml`:

```yaml
ports:
  - "3100:3000"  # expose gateway on host port 3100 instead of 3000
```
