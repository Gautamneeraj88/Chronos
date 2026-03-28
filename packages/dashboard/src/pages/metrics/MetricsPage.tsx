import { useQuery } from '@tanstack/react-query';
import { listExecutions } from '../../api/executions';
import { useMetrics } from '../../hooks/useMetrics';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { ExecutionStatusChart } from '../../components/charts/ExecutionStatusChart';
import { StepDurationChart } from '../../components/charts/StepDurationChart';
import { ActiveExecutionsGauge } from '../../components/charts/ActiveExecutionsGauge';
import { bottlenecks } from '../../api/graph';

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

export function MetricsPage() {
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
      <h2 className="page-title">Metrics</h2>

      {/* Active gauge + stat cards */}
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

      {/* Status distribution pie */}
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

      {/* Step duration bar chart */}
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

    </div>
  );
}
