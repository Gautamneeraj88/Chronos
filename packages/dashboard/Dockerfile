# ── Stage 1: Build React app ──────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/dashboard/package.json ./packages/dashboard/

RUN pnpm install --frozen-lockfile

COPY packages/dashboard ./packages/dashboard

# Build args — baked into the static bundle at build time
# In production, the nginx proxy handles /api/ so relative URLs work without VITE_API_URL
ARG VITE_API_URL=/api
ARG VITE_GRAFANA_URL=http://localhost:3004
ARG VITE_JAEGER_URL=http://localhost:16686

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GRAFANA_URL=$VITE_GRAFANA_URL
ENV VITE_JAEGER_URL=$VITE_JAEGER_URL

RUN pnpm --filter @chronos/dashboard build

# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine AS runtime

COPY --from=builder /app/packages/dashboard/dist /usr/share/nginx/html
COPY packages/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY packages/dashboard/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/health || exit 1

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
