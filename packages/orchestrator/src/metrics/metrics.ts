import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

export const executionStarted = new Counter({
  name: 'chronos_executions_started_total',
  help: 'Total executions started',
  registers: [register],
});

export const executionCompleted = new Counter({
  name: 'chronos_executions_completed_total',
  help: 'Total executions completed',
  labelNames: ['status'] as const, // COMPLETED | FAILED
  registers: [register],
});

export const stepDuration = new Histogram({
  name: 'chronos_step_duration_ms',
  help: 'Step execution duration in ms',
  labelNames: ['activityName', 'success'] as const,
  buckets: [100, 500, 1000, 2000, 5000, 10000],
  registers: [register],
});

export const activeExecutions = new Gauge({
  name: 'chronos_active_executions',
  help: 'Currently running executions',
  registers: [register],
});
