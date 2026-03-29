# Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and edit before starting.

---

## Orchestrator (`packages/orchestrator`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | **yes** | — | MongoDB connection string. Example: `mongodb://user:pass@host:27017/chronos?authSource=admin` |
| `REDIS_URL` | **yes** | — | Redis connection string. Example: `redis://:password@host:6379` |
| `KAFKA_BROKERS` | **yes** | `localhost:9092` | Comma-separated Kafka broker list. Example: `kafka1:9092,kafka2:9092` |
| `RABBITMQ_URL` | **yes** | — | AMQP connection string. Example: `amqp://user:pass@host:5672` |
| `NEO4J_URI` | **yes** | `bolt://localhost:7687` | Neo4j Bolt URI |
| `NEO4J_USERNAME` | **yes** | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | **yes** | `chronos_dev` | Neo4j password |
| `JWT_SECRET` | **yes** | `dev_secret_change_in_prod` | JWT signing secret — minimum 32 characters. **Change in production.** |
| `BOOTSTRAP_ADMIN_EMAIL` | no | `""` | Email for the first admin user. Only used when no users exist in the database. |
| `BOOTSTRAP_ADMIN_PASSWORD` | no | `""` | Password for the bootstrap admin. |
| `BOOTSTRAP_ORG_ID` | no | `default-org` | Org ID assigned to the bootstrap admin. |
| `ORCHESTRATOR_PORT` | no | `3001` | HTTP port the orchestrator listens on. |
| `NODE_ENV` | no | `development` | `development`, `production`, or `test`. |
| `LOG_LEVEL` | no | `info` | Winston log level: `debug`, `info`, `warn`, `error`. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | no | — | Jaeger OTLP endpoint. Example: `http://jaeger:4318`. Omit to disable tracing. |
| `LOKI_URL` | no | — | Loki push endpoint. Example: `http://loki:3100`. Omit to disable Loki transport. |

---

## API Gateway (`packages/api-gateway`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ORCHESTRATOR_URL` | **yes** | `http://localhost:3001` | Internal URL of the orchestrator service. |
| `JWT_SECRET` | **yes** | — | Must match the orchestrator's `JWT_SECRET`. |
| `REDIS_URL` | **yes** | — | Redis URL used for distributed rate limiting. |
| `GATEWAY_PORT` | no | `3000` | HTTP port the gateway listens on. |
| `NODE_ENV` | no | `development` | Environment. |
| `LOG_LEVEL` | no | `info` | Winston log level. |
| `DASHBOARD_URL` | no | `http://localhost:5173` | Dashboard origin for CORS. In production: `http://localhost:8080` or your domain. |
| `RATE_LIMIT_WINDOW_MS` | no | `60000` | Rate limit window in milliseconds. |
| `RATE_LIMIT_MAX` | no | `100` | Max requests per window per IP. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | no | — | Jaeger OTLP endpoint. |

---

## Worker (`packages/worker`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KAFKA_BROKERS` | **yes** | `localhost:9092` | Comma-separated Kafka broker list. |
| `PORT` | no | `3002` | HTTP port for the worker health endpoint. |
| `WORKER_ID` | no | `worker-{pid}` | Unique worker identifier. Set explicitly when running multiple instances (e.g., `worker-1`, `worker-2`). |
| `NODE_ENV` | no | `development` | Environment. |
| `LOG_LEVEL` | no | `info` | Winston log level. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | no | — | Jaeger OTLP endpoint. |
| `MOCK_FAILURE_RATE` | no | `0` | Float 0–1. Fraction of activities that randomly fail. Useful for testing compensation. |
| `MOCK_FAIL_STEPS` | no | — | Comma-separated step names that always fail (e.g., `charge-card,update-inventory`). |
| `MOCK_FAIL_ATTEMPTS` | no | — | `stepName:N` — fail only the first N attempts. Example: `charge-card:2`. |
| `MOCK_STEP_DELAY_MS` | no | `0` | Add artificial latency to all activities (ms). Useful for timeout testing. |

---

## Notifier (`packages/notifier`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RABBITMQ_URL` | **yes** | — | AMQP connection string. |
| `PORT` | no | `3003` | HTTP port for the notifier health endpoint. |
| `DASHBOARD_URL` | no | `http://localhost:5173` | Allowed CORS origin. |
| `NODE_ENV` | no | `development` | Environment. |
| `LOG_LEVEL` | no | `info` | Winston log level. |

---

## Dashboard — build-time (`packages/dashboard`)

These variables are baked into the static bundle at Vite build time. Change them by rebuilding or by passing `--build-arg` to `docker build`.

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api` | API gateway URL. In production nginx proxies `/api/` so the default works. In dev mode use `http://localhost:3000`. |
| `VITE_GRAFANA_URL` | `http://localhost:3004` | Grafana URL for embedded panel iframes. |
| `VITE_JAEGER_URL` | `http://localhost:16686` | Jaeger UI URL. |

---

## Infrastructure services

### MongoDB

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_INITDB_ROOT_USERNAME` | `root` | MongoDB root username (used only at first init). |
| `MONGO_INITDB_ROOT_PASSWORD` | `changeme` | MongoDB root password. **Change in production.** |
| `MONGO_USERNAME` | `chronos` | Application database username. |
| `MONGO_PASSWORD` | `changeme` | Application database password. **Change in production.** |

### Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_PASSWORD` | `changeme` | Redis password. **Change in production.** |

### Kafka

| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_ADVERTISED_LISTENERS` | — | Set to `PLAINTEXT://chronos-kafka:9092` in production so containers can reach each other. |

### RabbitMQ

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_DEFAULT_USER` | `chronos` | RabbitMQ admin username. |
| `RABBITMQ_DEFAULT_PASS` | `changeme` | RabbitMQ admin password. **Change in production.** |
| `RABBITMQ_ERLANG_COOKIE` | `changeme` | Erlang cluster cookie. **Change in production** — set to a random string. |

### Neo4j

| Variable | Default | Description |
|----------|---------|-------------|
| `NEO4J_AUTH` | `neo4j/changeme` | Neo4j username/password in `user/pass` format. |

### Grafana

| Variable | Default | Description |
|----------|---------|-------------|
| `GF_SECURITY_ADMIN_USER` | `admin` | Grafana admin username. |
| `GF_SECURITY_ADMIN_PASSWORD` | `admin` | Grafana admin password. **Change in production.** |

---

## Production `.env` checklist

Before going live, ensure every `changeme` default is replaced:

```bash
# Required
JWT_SECRET=<random 32+ char string>
BOOTSTRAP_ADMIN_EMAIL=admin@your-domain.com
BOOTSTRAP_ADMIN_PASSWORD=<strong password>

# Change all of these from 'changeme'
MONGO_INITDB_ROOT_PASSWORD=<strong>
MONGO_PASSWORD=<strong>
REDIS_PASSWORD=<strong>
RABBITMQ_DEFAULT_PASS=<strong>
RABBITMQ_ERLANG_COOKIE=<random string>
GF_SECURITY_ADMIN_PASSWORD=<strong>
NEO4J_AUTH=neo4j/<strong>
```

Generate a secure JWT_SECRET:

```bash
openssl rand -base64 48
```
