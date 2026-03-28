import axios from 'axios';

// Orchestrator exposes /metrics in Prometheus text format.
// The dashboard fetches directly from orchestrator (port 3001) since
// the gateway doesn't proxy /metrics.
const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL ?? 'http://localhost:3001';

export interface ParsedMetrics {
  activeExecutions: number;
  executionsStarted: number;
  executionsCompleted: number;
  executionsFailed: number;
}

function extractCounter(text: string, name: string): number {
  const regex = new RegExp(`^${name}(?:\\{[^}]*\\})?\\s+(\\S+)`, 'm');
  const match = regex.exec(text);
  return match ? parseFloat(match[1]) || 0 : 0;
}

export async function fetchMetrics(): Promise<ParsedMetrics> {
  const { data } = await axios.get<string>(`${ORCHESTRATOR_URL}/metrics`, {
    headers: { Accept: 'text/plain' },
  });

  return {
    activeExecutions:    extractCounter(data, 'chronos_active_executions'),
    executionsStarted:   extractCounter(data, 'chronos_executions_started_total'),
    executionsCompleted: extractCounter(data, 'chronos_executions_completed_total\\{status="COMPLETED"\\}') ||
                         extractCounter(data, 'chronos_executions_completed_total'),
    executionsFailed:    extractCounter(data, 'chronos_executions_completed_total\\{status="FAILED"\\}'),
  };
}
