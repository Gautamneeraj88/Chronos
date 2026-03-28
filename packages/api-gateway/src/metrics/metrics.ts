import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export const register = new Registry();

// Collect Node.js process metrics (heap, event loop, GC) for free
collectDefaultMetrics({ register });

export const httpRequestsTotal = new Counter({
  name: 'chronos_gateway_requests_total',
  help: 'Total HTTP requests to the gateway',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'chronos_gateway_request_duration_ms',
  help: 'HTTP request duration in ms',
  labelNames: ['method', 'route'] as const,
  buckets: [50, 100, 200, 500, 1000, 2000],
  registers: [register],
});

export const authFailures = new Counter({
  name: 'chronos_gateway_auth_failures_total',
  help: 'Total authentication failures at the gateway',
  labelNames: ['reason'] as const,
  registers: [register],
});
