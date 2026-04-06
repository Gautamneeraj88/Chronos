# Secrets Management

Chronos requires several secrets to operate. **Never commit secrets to the repository.**

## Required Secrets

| Variable | Where used | Example / How to generate |
|---|---|---|
| `JWT_SECRET` | Orchestrator | `openssl rand -hex 32` (min 32 chars) |
| `MONGO_USERNAME` | MongoDB, Orchestrator | `chronos` |
| `MONGO_PASSWORD` | MongoDB, Orchestrator | `openssl rand -hex 16` |
| `REDIS_PASSWORD` | Redis, Orchestrator, Gateway | `openssl rand -hex 16` |
| `RABBITMQ_USER` | RabbitMQ, Orchestrator, Notifier | `chronos` |
| `RABBITMQ_PASSWORD` | RabbitMQ, Orchestrator, Notifier | `openssl rand -hex 16` |
| `RABBITMQ_ERLANG_COOKIE` | RabbitMQ | `openssl rand -hex 32` |
| `NEO4J_PASSWORD` | Neo4j, Orchestrator | `openssl rand -hex 16` |
| `GRAFANA_ADMIN_PASSWORD` | Grafana | `openssl rand -hex 16` |
| `BOOTSTRAP_ADMIN_PASSWORD` | Orchestrator bootstrap | strong password — rotate after first login |

---

## Docker / Podman

Create a `.env` file at the repository root (never commit it):

```bash
# Generate and copy into .env
JWT_SECRET=$(openssl rand -hex 32)
MONGO_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 16)
RABBITMQ_PASSWORD=$(openssl rand -hex 16)
RABBITMQ_ERLANG_COOKIE=$(openssl rand -hex 32)
NEO4J_PASSWORD=$(openssl rand -hex 16)
GRAFANA_ADMIN_PASSWORD=$(openssl rand -hex 16)
BOOTSTRAP_ADMIN_PASSWORD=change-me-after-first-login
BOOTSTRAP_ADMIN_EMAIL=admin@your-domain.com
BOOTSTRAP_ORG_ID=your-org
```

Docker Compose reads `.env` automatically. `docker-compose.prod.yml` uses `${VAR}` references with no defaults for secrets — Docker will warn at startup if any variable is unset.

---

## Kubernetes

Create a `Secret` manifest. Do not store the manifest in git — generate it from a secrets manager or CI pipeline:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: chronos-secrets
  namespace: chronos
type: Opaque
stringData:
  JWT_SECRET: "<generated>"
  MONGO_PASSWORD: "<generated>"
  REDIS_PASSWORD: "<generated>"
  RABBITMQ_PASSWORD: "<generated>"
  RABBITMQ_ERLANG_COOKIE: "<generated>"
  NEO4J_PASSWORD: "<generated>"
```

Reference in your `Deployment` manifests:

```yaml
env:
  - name: JWT_SECRET
    valueFrom:
      secretKeyRef:
        name: chronos-secrets
        key: JWT_SECRET
```

---

## HashiCorp Vault / AWS Secrets Manager

Inject secrets as environment variables at container start using the provider sidecar or init container pattern.

**Vault (Agent Sidecar):** annotate the pod to have Vault Agent render secrets into a file that the init container exports as environment variables.

**AWS Secrets Manager:** use the AWS Secrets Manager CSI driver or a Lambda/ECS task role to inject secrets before the application starts. The application reads standard `process.env` — no code changes required.

---

## Rotation

- **JWT_SECRET:** rotating this invalidates all active sessions. Coordinate with users or use a dual-key approach (accept old key for a short window).
- **Database passwords:** update the secret store first, then redeploy services — connection pooling means existing connections drain gracefully.
- **API keys:** revoke via `DELETE /api-keys/:id` — does not require a redeploy.
