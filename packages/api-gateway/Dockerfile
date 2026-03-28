# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests (better layer caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy package.json files needed for workspace resolution
COPY packages/shared/package.json ./packages/shared/
COPY packages/kafka/package.json ./packages/kafka/
COPY packages/rabbitmq/package.json ./packages/rabbitmq/
COPY packages/neo4j/package.json ./packages/neo4j/
COPY packages/api-gateway/package.json ./packages/api-gateway/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/kafka/src ./packages/kafka/src
COPY packages/kafka/tsconfig.json ./packages/kafka/
COPY packages/rabbitmq/src ./packages/rabbitmq/src
COPY packages/rabbitmq/tsconfig.json ./packages/rabbitmq/
COPY packages/neo4j/src ./packages/neo4j/src
COPY packages/neo4j/tsconfig.json ./packages/neo4j/
COPY packages/api-gateway/src ./packages/api-gateway/src
COPY packages/api-gateway/tsconfig.json ./packages/api-gateway/

RUN pnpm --filter @chronos/shared build && \
    pnpm --filter @chronos/kafka build && \
    pnpm --filter @chronos/rabbitmq build && \
    pnpm --filter @chronos/neo4j build && \
    pnpm --filter @chronos/api-gateway build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/kafka/package.json ./packages/kafka/
COPY packages/rabbitmq/package.json ./packages/rabbitmq/
COPY packages/neo4j/package.json ./packages/neo4j/
COPY packages/api-gateway/package.json ./packages/api-gateway/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/kafka/dist ./packages/kafka/dist
COPY --from=builder /app/packages/rabbitmq/dist ./packages/rabbitmq/dist
COPY --from=builder /app/packages/neo4j/dist ./packages/neo4j/dist
COPY --from=builder /app/packages/api-gateway/dist ./packages/api-gateway/dist

USER node

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["node", "packages/api-gateway/dist/server.js"]
