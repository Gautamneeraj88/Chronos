import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getWorkflow } from '../../api/workflows';
import { listExecutions } from '../../api/executions';
import { bottlenecks } from '../../api/graph';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { WorkflowDAG } from '../../components/workflow/WorkflowDAG';
import { BottleneckTable } from '../../components/graph/BottleneckTable';

type Tab = 'steps' | 'dag' | 'executions' | 'graph';

export function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('steps');

  const { data: workflow, isLoading: wfLoading } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => getWorkflow(id!),
    enabled: !!id,
  });

  const { data: executions = [], isLoading: exLoading } = useQuery({
    queryKey: ['executions', { tab }],
    queryFn: () => listExecutions(),
    enabled: tab === 'executions',
  });

  const { data: stepBottlenecks = [], isLoading: bnLoading } = useQuery({
    queryKey: ['bottlenecks', id],
    queryFn: bottlenecks,
    enabled: tab === 'graph',
  });

  if (wfLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  if (!workflow) return <p className="text-gray-500">Workflow not found.</p>;

  const wfExecutions = executions.filter((e) => e.workflowId === workflow.id).slice(0, 20);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'steps', label: 'Steps' },
    { key: 'dag', label: 'DAG' },
    { key: 'executions', label: 'Executions' },
    { key: 'graph', label: 'Graph' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <p className="text-sm text-gray-500 mb-1">
          <Link to="/workflows" className="hover:text-brand-600">Workflows</Link> / {workflow.name}
        </p>
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-gray-800">{workflow.name}</h2>
          <span className="text-gray-400 text-sm">v{workflow.version}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Org: {workflow.orgId} · Created {new Date(workflow.createdAt).toLocaleString()}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === t.key
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'steps' && (
        <Card>
          <CardHeader>Steps ({workflow.steps.length})</CardHeader>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['#', 'Name', 'Activity', 'Retries', 'Timeout', 'Compensation'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {workflow.steps.map((step, i) => (
                  <tr key={step.name}>
                    <td className="px-4 py-2 text-sm text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2 text-sm font-medium text-gray-800">{step.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 font-mono">{step.activity}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{step.retries}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{step.timeoutMs}ms</td>
                    <td className="px-4 py-2 text-sm text-gray-400">{step.compensation ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'dag' && (
        <Card>
          <CardHeader>Workflow DAG</CardHeader>
          <CardBody>
            <WorkflowDAG steps={workflow.steps} />
          </CardBody>
        </Card>
      )}

      {tab === 'graph' && (
        <Card>
          <CardHeader>Step Bottlenecks (Neo4j)</CardHeader>
          {bnLoading ? (
            <CardBody><Spinner /></CardBody>
          ) : (
            <BottleneckTable bottlenecks={stepBottlenecks} />
          )}
        </Card>
      )}

      {tab === 'executions' && (
        <Card>
          <CardHeader>Recent Executions</CardHeader>
          {exLoading ? (
            <CardBody><Spinner /></CardBody>
          ) : wfExecutions.length === 0 ? (
            <CardBody><p className="text-sm text-gray-500">No executions yet.</p></CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['ID', 'Status', 'Started', 'Duration'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {wfExecutions.map((ex) => {
                    const dur = ex.completedAt
                      ? `${((new Date(ex.completedAt).getTime() - new Date(ex.startedAt).getTime()) / 1000).toFixed(1)}s`
                      : '—';
                    return (
                      <tr key={ex.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <Link to={`/executions/${ex.id}`} className="text-xs font-mono text-brand-600 hover:underline">
                            {ex.id.slice(0, 8)}…
                          </Link>
                        </td>
                        <td className="px-4 py-2"><StatusBadge status={ex.status} /></td>
                        <td className="px-4 py-2 text-xs text-gray-500">{new Date(ex.startedAt).toLocaleString()}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{dur}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
