import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getGqlClient } from '../../graphql/client';
import {
  FAILURE_PATHS_QUERY,
  BOTTLENECKS_QUERY,
  WORKFLOWS_BY_ACTIVITY_QUERY,
  EXECUTION_GRAPH_QUERY,
} from '../../graphql/queries';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { ExecutionGraphFlow } from '../../components/graph/ExecutionGraphFlow';
import type { StepFailureStat, StepBottleneck, WorkflowMatch, StepExecutionRecord } from '../../types';

export function GraphExplorerPage() {
  const { orgId } = useAuth();
  const [activityQuery, setActivityQuery] = useState('');
  const [activitySearch, setActivitySearch] = useState('');
  const [execIdQuery, setExecIdQuery] = useState('');
  const [execIdSearch, setExecIdSearch] = useState('');

  const { data: failurePaths = [], isLoading: fpLoading } = useQuery<StepFailureStat[]>({
    queryKey: ['failure-paths', orgId],
    queryFn: async () => {
      const client = getGqlClient();
      const res = await client.request<{ failurePaths: StepFailureStat[] }>(
        FAILURE_PATHS_QUERY,
        { orgId },
      );
      return res.failurePaths;
    },
    enabled: !!orgId,
  });

  const { data: bottlenecks = [], isLoading: bnLoading } = useQuery<StepBottleneck[]>({
    queryKey: ['bottlenecks', orgId],
    queryFn: async () => {
      const client = getGqlClient();
      const res = await client.request<{ bottlenecks: StepBottleneck[] }>(
        BOTTLENECKS_QUERY,
        { orgId },
      );
      return res.bottlenecks;
    },
    enabled: !!orgId,
  });

  const { data: workflowsByActivity = [], isLoading: wbaLoading } =
    useQuery<WorkflowMatch[]>({
      queryKey: ['workflows-by-activity', activitySearch],
      queryFn: async () => {
        if (!activitySearch) return [];
        const client = getGqlClient();
        const res = await client.request<{ workflowsByActivity: WorkflowMatch[] }>(
          WORKFLOWS_BY_ACTIVITY_QUERY,
          { activityName: activitySearch },
        );
        return res.workflowsByActivity;
      },
      enabled: !!activitySearch,
    });

  const { data: execGraph = [], isLoading: egLoading } =
    useQuery<StepExecutionRecord[]>({
      queryKey: ['execution-graph', execIdSearch],
      queryFn: async () => {
        if (!execIdSearch) return [];
        const client = getGqlClient();
        const res = await client.request<{ executionGraph: StepExecutionRecord[] }>(
          EXECUTION_GRAPH_QUERY,
          { executionId: execIdSearch },
        );
        return res.executionGraph;
      },
      enabled: !!execIdSearch,
    });

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-gray-800">Graph Explorer</h2>

      {/* Failure Paths */}
      <Card>
        <CardHeader>Failure Paths</CardHeader>
        {fpLoading ? (
          <CardBody><Spinner /></CardBody>
        ) : failurePaths.length === 0 ? (
          <CardBody><p className="text-sm text-gray-500">No failures recorded.</p></CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Step', 'Activity', 'Failure Count', 'Bar'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {failurePaths.map((fp) => {
                  const max = Math.max(...failurePaths.map((f) => f.failureCount));
                  const pct = (fp.failureCount / max) * 100;
                  return (
                    <tr key={fp.step}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-800">{fp.step}</td>
                      <td className="px-4 py-2 text-sm text-gray-500 font-mono">{fp.activity}</td>
                      <td className="px-4 py-2 text-sm text-red-600 font-semibold">{fp.failureCount}</td>
                      <td className="px-4 py-2 w-32">
                        <div className="bg-red-100 rounded-full h-2">
                          <div className="bg-red-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Bottlenecks */}
      <Card>
        <CardHeader>Bottlenecks</CardHeader>
        {bnLoading ? (
          <CardBody><Spinner /></CardBody>
        ) : bottlenecks.length === 0 ? (
          <CardBody><p className="text-sm text-gray-500">No bottleneck data.</p></CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Step', 'Activity', 'Avg Duration', 'Max Duration', 'Executions', 'Bar'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {bottlenecks.map((bn) => {
                  const max = Math.max(...bottlenecks.map((b) => b.avgDurationMs));
                  const pct = (bn.avgDurationMs / max) * 100;
                  return (
                    <tr key={bn.step}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-800">{bn.step}</td>
                      <td className="px-4 py-2 text-sm text-gray-500 font-mono">{bn.activity}</td>
                      <td className="px-4 py-2 text-sm text-amber-600 font-semibold">{bn.avgDurationMs.toFixed(0)}ms</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{bn.maxDurationMs.toFixed(0)}ms</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{bn.executionCount}</td>
                      <td className="px-4 py-2 w-32">
                        <div className="bg-amber-100 rounded-full h-2">
                          <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Activity Explorer */}
      <Card>
        <CardHeader>Activity Explorer</CardHeader>
        <CardBody>
          <p className="text-sm text-gray-500 mb-3">Find all workflows that use a given activity.</p>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="e.g. chargeCard"
              value={activityQuery}
              onChange={(e) => setActivityQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setActivitySearch(activityQuery); } }}
              className="flex-1"
            />
            <Button onClick={() => setActivitySearch(activityQuery)}>Search</Button>
          </div>
          {wbaLoading ? (
            <Spinner />
          ) : workflowsByActivity.length > 0 ? (
            <div className="flex flex-col gap-2">
              {workflowsByActivity.map((wf) => (
                <div key={wf.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded border border-gray-200">
                  <span className="font-medium text-sm text-gray-800">{wf.name}</span>
                  <span className="text-xs text-gray-400 font-mono">{wf.id.slice(0, 8)}…</span>
                </div>
              ))}
            </div>
          ) : activitySearch ? (
            <p className="text-sm text-gray-500">No workflows found using "{activitySearch}".</p>
          ) : null}
        </CardBody>
      </Card>

      {/* Execution Graph */}
      <Card>
        <CardHeader>Execution Graph</CardHeader>
        <CardBody>
          <p className="text-sm text-gray-500 mb-3">View step-by-step execution details from Neo4j.</p>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Execution ID"
              value={execIdQuery}
              onChange={(e) => setExecIdQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setExecIdSearch(execIdQuery); } }}
              className="flex-1 font-mono"
            />
            <Button onClick={() => setExecIdSearch(execIdQuery)}>Load</Button>
          </div>
          {egLoading ? (
            <Spinner />
          ) : execGraph.length > 0 ? (
            <ExecutionGraphFlow records={execGraph} />
          ) : execIdSearch ? (
            <p className="text-sm text-gray-500">No graph data for this execution.</p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
