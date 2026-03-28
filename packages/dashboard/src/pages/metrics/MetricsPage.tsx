import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listExecutions } from '../../api/executions';
import { useMetrics } from '../../hooks/useMetrics';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { ExecutionStatusChart } from '../../components/charts/ExecutionStatusChart';
import { StepDurationChart } from '../../components/charts/StepDurationChart';
import { ActiveExecutionsGauge } from '../../components/charts/ActiveExecutionsGauge';
import { bottlenecks } from '../../api/graph';

const GRAFANA_BASE = import.meta.env.VITE_GRAFANA_URL ?? '';

const PANELS = {
  activeExecutions:   `${GRAFANA_BASE}/d-solo/chronos-main/chronos-overview?orgId=1&panelId=1&theme=light`,
  executionsOverTime: `${GRAFANA_BASE}/d-solo/chronos-main/chronos-overview?orgId=1&panelId=2&theme=light`,
  successRate:        `${GRAFANA_BASE}/d-solo/chronos-main/chronos-overview?orgId=1&panelId=3&theme=light`,
  gatewayRequests:    `${GRAFANA_BASE}/d-solo/chronos-main/chronos-overview?orgId=1&panelId=4&theme=light`,
  stepDurations:      `${GRAFANA_BASE}/d-solo/chronos-steps/chronos-step-performance?orgId=1&panelId=1&theme=light`,
  stepFailures:       `${GRAFANA_BASE}/d-solo/chronos-steps/chronos-step-performance?orgId=1&panelId=2&theme=light`,
  allLogs:            `${GRAFANA_BASE}/d-solo/chronos-logs/chronos-logs?orgId=1&panelId=1&theme=light&from=now-1h&to=now`,
  errorLogs:          `${GRAFANA_BASE}/d-solo/chronos-logs/chronos-logs?orgId=1&panelId=2&theme=light&from=now-1h&to=now`,
};

type Tab = 'overview' | 'grafana' | 'logs';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </CardBody>
    </Card>
  );
}

function GrafanaPanel({ src, title, height = 240 }: { src: string; title: string; height?: number }) {
  if (!GRAFANA_BASE) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200 text-sm text-gray-400" style={{ height }}>
        Set <code className="mx-1 px-1 bg-gray-100 rounded text-xs">VITE_GRAFANA_URL</code> to enable Grafana panels
      </div>
    );
  }
  return (
    <iframe
      src={src}
      width="100%"
      height={height}
      frameBorder="0"
      title={title}
      className="rounded-lg"
    />
  );
}

export function MetricsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: executions = [], isLoading: exLoading } = useQuery({
    queryKey: ['executions-all'],
    queryFn: () => listExecutions(),
    refetchInterval: 30_000,
  });

  const { data: metrics, isLoading: metricsLoading } = useMetrics();

  const { data: stepBottlenecks = [], isLoading: bnLoading } = useQuery({
    queryKey: ['bottlenecks'],
    queryFn: bottlenecks,
    refetchInterval: 60_000,
  });

  const active = metrics?.activeExecutions ?? executions.filter((e) => e.status === 'RUNNING' || e.status === 'PENDING').length;
  const completed = executions.filter((e) => e.status === 'COMPLETED').length;
  const failed = executions.filter((e) => e.status === 'FAILED').length;
  const running = executions.filter((e) => e.status === 'RUNNING').length;
  const total = executions.length;
  const successRate = total > 0 ? `${Math.round((completed / total) * 100)}%` : '—';

  const isLoading = exLoading || metricsLoading;

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header">
        <h2 className="page-title">Metrics</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['overview', 'grafana', 'logs'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview tab — existing custom charts */}
      {activeTab === 'overview' && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner size="lg" /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
              <div className="md:col-span-1">
                <Card>
                  <CardBody>
                    <ActiveExecutionsGauge active={active} isLoading={metricsLoading} />
                  </CardBody>
                </Card>
              </div>
              <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Executions" value={total} />
                <StatCard label="Completed" value={completed} />
                <StatCard label="Failed" value={failed} />
                <StatCard label="Success Rate" value={successRate} />
              </div>
            </div>
          )}

          <Card>
            <CardHeader>Execution Status Distribution</CardHeader>
            <CardBody>
              {exLoading ? (
                <div className="flex justify-center py-4"><Spinner /></div>
              ) : (
                <ExecutionStatusChart completed={completed} failed={failed} running={running} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>Step Bottlenecks</CardHeader>
            <CardBody>
              {bnLoading ? (
                <div className="flex justify-center py-4"><Spinner /></div>
              ) : (
                <StepDurationChart bottlenecks={stepBottlenecks} />
              )}
            </CardBody>
          </Card>
        </>
      )}

      {/* Grafana tab — embedded Prometheus panels */}
      {activeTab === 'grafana' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>Active Executions</CardHeader>
              <CardBody className="p-0">
                <GrafanaPanel src={PANELS.activeExecutions} title="Active Executions" height={160} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>Success Rate (1h)</CardHeader>
              <CardBody className="p-0">
                <GrafanaPanel src={PANELS.successRate} title="Success Rate" height={160} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>Gateway Requests</CardHeader>
              <CardBody className="p-0">
                <GrafanaPanel src={PANELS.gatewayRequests} title="Gateway Requests" height={160} />
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader>Executions Over Time</CardHeader>
            <CardBody className="p-0">
              <GrafanaPanel src={PANELS.executionsOverTime} title="Executions Over Time" height={300} />
            </CardBody>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>Step p95 Duration</CardHeader>
              <CardBody className="p-0">
                <GrafanaPanel src={PANELS.stepDurations} title="Step Durations" height={280} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>Step Failure Rate</CardHeader>
              <CardBody className="p-0">
                <GrafanaPanel src={PANELS.stepFailures} title="Step Failures" height={280} />
              </CardBody>
            </Card>
          </div>
          {GRAFANA_BASE && (
            <p className="text-xs text-gray-400 text-center">
              Full dashboards at{' '}
              <a href={GRAFANA_BASE} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">
                {GRAFANA_BASE}
              </a>
            </p>
          )}
        </div>
      )}

      {/* Logs tab — Loki log explorer */}
      {activeTab === 'logs' && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>All Service Logs</CardHeader>
            <CardBody className="p-0">
              <GrafanaPanel src={PANELS.allLogs} title="All Service Logs" height={400} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>Error Logs</CardHeader>
            <CardBody className="p-0">
              <GrafanaPanel src={PANELS.errorLogs} title="Error Logs" height={320} />
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
