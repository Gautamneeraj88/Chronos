# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/rabbitmq/package.json ./packages/rabbitmq/
COPY packages/notifier/package.json ./packages/notifier/

RUN pnpm install --frozen-lockfile

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/rabbitmq/src ./packages/rabbitmq/src
COPY packages/rabbitmq/tsconfig.json ./packages/rabbitmq/
COPY packages/notifier/src ./packages/notifier/src
COPY packages/notifier/tsconfig.json ./packages/notifier/

RUN pnpm --filter @chronos/shared build && \
    pnpm --filter @chronos/rabbitmq build && \
    pnpm --filter @chronos/notifier build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/rabbitmq/package.json ./packages/rabbitmq/
COPY packages/notifier/package.json ./packages/notifier/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/rabbitmq/dist ./packages/rabbitmq/dist
COPY --from=builder /app/packages/notifier/dist ./packages/notifier/dist

USER node

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://localhost:3003/health || exit 1

EXPOSE 3003
CMD ["node", "packages/notifier/dist/server.js"]
