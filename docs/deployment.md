# Deployment Guide

## Minimum requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disk | 10 GB | 40 GB (for MongoDB + Neo4j data) |
| Docker | 24+ | latest |

## Production checklist

Before going live, complete every item:

```
Infrastructure
□ Change MONGO_INITDB_ROOT_PASSWORD from 'changeme'
□ Change MONGO_PASSWORD from 'changeme'
□ Change REDIS_PASSWORD from 'changeme'
□ Change RABBITMQ_DEFAULT_PASS from 'changeme'
□ Change RABBITMQ_ERLANG_COOKIE to a random string
□ Change NEO4J_AUTH to neo4j/<strong-password>
□ Change GF_SECURITY_ADMIN_PASSWORD from 'admin'

Application
□ Set JWT_SECRET to openssl rand -base64 48
□ Set BOOTSTRAP_ADMIN_EMAIL to your admin email
□ Set BOOTSTRAP_ADMIN_PASSWORD to a strong password

Network
□ Put api-gateway and dashboard behind a reverse proxy (nginx or Caddy)
□ Enable TLS on the reverse proxy
□ Do NOT expose MongoDB (27017), Redis (6379), Kafka (9092), Neo4j (7687) to the internet
□ Optionally restrict /metrics endpoints to internal network only

Backup
□ Set up MongoDB backup (see below)
□ Set up Neo4j backup (see below)
```

## One-command start

```bash
docker compose -f docker-compose.prod.yml up -d
# or
podman-compose -f docker-compose.prod.yml up -d
```

## Scaling workers

Workers are stateless. Run as many as you have Kafka partitions (6 per topic = max 6 workers).

Add to `docker-compose.prod.yml`:

```yaml
services:
  worker-1:
    image: ghcr.io/gautamneeraj88/chronos/worker:latest
    env_file: .env
    environment:
      WORKER_ID: worker-1
      KAFKA_BROKERS: chronos-kafka:9092
    depends_on:
      chronos-kafka:
        condition: service_healthy

  worker-2:
    image: ghcr.io/gautamneeraj88/chronos/worker:latest
    env_file: .env
    environment:
      WORKER_ID: worker-2
      KAFKA_BROKERS: chronos-kafka:9092
    depends_on:
      chronos-kafka:
        condition: service_healthy
```

## Reverse proxy — nginx

Expose only the gateway and dashboard publicly. All other services stay on the internal Docker network.

```nginx
# /etc/nginx/sites-available/chronos
server {
    listen 80;
    server_name chronos.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chronos.example.com;

    ssl_certificate     /etc/letsencrypt/live/chronos.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chronos.example.com/privkey.pem;

    # Dashboard — serve the React SPA
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API Gateway — REST
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # GraphQL + WebSocket upgrade
    location /graphql {
        proxy_pass http://localhost:3000/graphql;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Reverse proxy — Caddy

```caddyfile
chronos.example.com {
    # Dashboard
    handle /* {
        reverse_proxy localhost:8080
    }

    # API Gateway
    handle /api/* {
        uri strip_prefix /api
        reverse_proxy localhost:3000
    }

    # GraphQL
    handle /graphql* {
        reverse_proxy localhost:3000
    }
}
```

## Updating images

```bash
# Pull latest images
docker compose -f docker-compose.prod.yml pull

# Restart with zero downtime (rolling where possible)
docker compose -f docker-compose.prod.yml up -d

# Verify health
bash scripts/health-check.sh
```

## Pinning image versions

In production, pin to a specific version rather than `latest`:

```yaml
# docker-compose.prod.yml
services:
  chronos-gateway:
    image: ghcr.io/gautamneeraj88/chronos/api-gateway:v0.9.0
```

## Backup strategy

### MongoDB — daily snapshot

```bash
#!/bin/bash
# scripts/backup-mongo.sh
DATE=$(date +%Y%m%d-%H%M)
BACKUP_DIR=/backup/mongodb/$DATE

docker exec chronos-mongodb mongodump \
  --uri="mongodb://chronos:${MONGO_PASSWORD}@localhost:27017/chronos?authSource=admin" \
  --out=/tmp/dump

docker cp chronos-mongodb:/tmp/dump $BACKUP_DIR
echo "MongoDB backup complete: $BACKUP_DIR"
```

Schedule with cron:
```
0 2 * * * /path/to/scripts/backup-mongo.sh
```

### Neo4j — online backup

```bash
#!/bin/bash
# scripts/backup-neo4j.sh
DATE=$(date +%Y%m%d-%H%M)

docker exec chronos-neo4j neo4j-admin database dump neo4j \
  --to-path=/tmp/neo4j-backup-$DATE.dump

docker cp chronos-neo4j:/tmp/neo4j-backup-$DATE.dump /backup/neo4j/
echo "Neo4j backup complete"
```

### Redis — RDB snapshot

Redis persists to disk via RDB snapshots by default. Configure the interval in `redis.conf`:

```
save 900 1    # after 900 seconds if at least 1 key changed
save 300 10   # after 300 seconds if at least 10 keys changed
save 60 10000 # after 60 seconds if at least 10000 keys changed
```

Copy the RDB file for backup:
```bash
docker cp chronos-redis:/data/dump.rdb /backup/redis/dump-$(date +%Y%m%d).rdb
```

## Monitoring

Grafana dashboards are pre-provisioned at **http://localhost:3004** (or your Grafana host).

Key dashboards:
- **Execution Overview** — executions per minute, success/failure rate, compensation rate
- **Step Latency** — p50/p95/p99 duration per activity type
- **DLQ Depth** — unprocessable messages in `chronos.step.dlq`
- **System** — CPU, memory, Kafka consumer lag

Set up alerting rules in Grafana for:
- `dlq_messages_total` rate > 0 (messages entering DLQ)
- Kafka consumer lag growing over time
- Any service health endpoint returning non-200

## Logs

Logs are shipped to Loki via `winston-loki`. Search them in Grafana → Explore:

```logql
{service="orchestrator"} |= "STEP_FAILED"
{service="orchestrator"} | json | executionId = "..."
{service="worker"} | json | level = "error"
```

## Distributed traces

Traces are in Jaeger at **http://localhost:16686**. Search by:
- Service: `api-gateway`, `orchestrator`, `worker`
- Operation: `POST /executions`, `saga-advance`, `activity-execute`
- Tags: `executionId`, `workflowId`
