import { Registry, Histogram, Counter } from 'prom-client';

export const register = new Registry();

export const stepDuration = new Histogram({
  name: 'chronos_worker_step_duration_ms',
  help: 'Step execution duration in ms',
  labelNames: ['activityName', 'success'] as const,
  buckets: [100, 500, 1000, 2000, 5000, 10000],
  registers: [register],
});

export const stepAttempts = new Counter({
  name: 'chronos_worker_step_attempts_total',
  help: 'Total step execution attempts',
  labelNames: ['activityName', 'success'] as const,
  registers: [register],
});
