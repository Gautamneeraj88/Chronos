import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getExecution, getExecutionEvents } from '../../api/executions';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { ExecutionTimeline } from '../../components/execution/ExecutionTimeline';
import { useExecutionSubscription } from '../../hooks/useExecutionSubscription';
import type { Execution } from '../../types';

type Tab = 'timeline' | 'output' | 'events';

export function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('timeline');
  const queryClient = useQueryClient();

  const { data: execution, isLoading: exLoading } = useQuery({
    queryKey: ['execution', id],
    queryFn: () => getExecution(id!),
    refetchInterval: 3000,
    enabled: !!id,
  });

  const { data: events = [], isLoading: evLoading } = useQuery({
    queryKey: ['execution-events', id],
    queryFn: () => getExecutionEvents(id!),
    refetchInterval: 3000,
    enabled: !!id,
  });

  // GraphQL subscription for real-time status updates
  const { connected } = useExecutionSubscription(id, (update) => {
    queryClient.setQueryData(
      ['execution', id],
      (old: Execution | undefined) =>
        old
          ? { ...old, status: update.status, completedAt: update.completedAt ?? old.completedAt, error: update.error ?? old.error }
          : old,
    );
    // Also refresh events when execution completes/fails
    if (update.status === 'COMPLETED' || update.status === 'FAILED') {
      void queryClient.invalidateQueries({ queryKey: ['execution-events', id] });
    }
  });

  if (exLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  if (!execution) return <p className="text-gray-500">Execution not found.</p>;

  const duration = execution.completedAt
    ? `${((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000).toFixed(1)}s`
    : 'In progress…';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'output', label: 'Output' },
    { key: 'events', label: 'Raw Events' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <p className="text-sm text-gray-500 mb-1">
          <Link to="/executions" className="hover:text-brand-600">Executions</Link> / {id?.slice(0, 8)}…
        </p>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-800 font-mono text-base">{id}</h2>
          <StatusBadge status={execution.status} />
          {connected && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              live
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Workflow: {execution.workflowId.slice(0, 8)}… · v{execution.workflowVersion} · Duration: {duration}
        </p>
        {execution.error && (
          <p className="text-sm text-red-500 mt-2">Error: {execution.error}</p>
        )}
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

      {tab === 'timeline' && (
        <ExecutionTimeline events={events} isLoading={evLoading} />
      )}

      {tab === 'output' && (
        <Card>
          <CardHeader>Execution Output</CardHeader>
          <CardBody>
            <pre className="text-xs font-mono bg-gray-50 p-3 rounded overflow-x-auto">
              {JSON.stringify(execution.output, null, 2)}
            </pre>
          </CardBody>
        </Card>
      )}

      {tab === 'events' && (
        <Card>
          <CardHeader>Raw Event Log</CardHeader>
          {evLoading ? (
            <CardBody><Spinner /></CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {['Type', 'Step', 'Occurred At', 'Payload'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono">
                  {events.map((ev) => (
                    <tr key={ev.id}>
                      <td className="px-4 py-2">{ev.type}</td>
                      <td className="px-4 py-2 text-gray-500">{ev.stepName ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{new Date(ev.occurredAt).toLocaleTimeString()}</td>
                      <td className="px-4 py-2 text-gray-400 max-w-xs truncate">
                        {JSON.stringify(ev.payload)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
