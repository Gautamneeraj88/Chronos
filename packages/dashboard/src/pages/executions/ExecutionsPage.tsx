import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Play } from 'lucide-react';
import { listExecutions, triggerExecution } from '../../api/executions';
import { listWorkflows } from '../../api/workflows';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import type { Execution } from '../../types';

const STATUS_OPTIONS = ['', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'COMPENSATING'];

export function ExecutionsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState('');
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [inputJson, setInputJson] = useState('{}');
  const [jsonError, setJsonError] = useState('');
  const [triggering, setTriggering] = useState(false);

  const { data: allExecutions = [], isLoading } = useQuery({
    queryKey: ['executions', statusFilter],
    queryFn: () => listExecutions(statusFilter || undefined),
    refetchInterval: 5000,
  });

  const executions = workflowFilter
    ? allExecutions.filter((e) => e.workflowId === workflowFilter)
    : allExecutions;

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows'],
    queryFn: listWorkflows,
  });

  const handleTrigger = async () => {
    setJsonError('');
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(inputJson) as Record<string, unknown>;
    } catch {
      setJsonError('Invalid JSON');
      return;
    }
    setTriggering(true);
    try {
      const ex = await triggerExecution(selectedWorkflow, parsed);
      toast.success('Execution started', {
        description: `ID: ${ex.id.slice(0, 12)}…`,
      });
      navigate(`/executions/${ex.id}`);
    } catch (err) {
      toast.error('Failed to trigger execution', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setTriggering(false);
      setTriggerOpen(false);
    }
  };

  const workflowMap = Object.fromEntries(workflows.map((w) => [w.id, w.name]));

  const duration = (ex: Execution) => {
    if (!ex.completedAt) return '—';
    const ms = new Date(ex.completedAt).getTime() - new Date(ex.startedAt).getTime();
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Executions</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s || 'All statuses'}</option>
            ))}
          </select>
          <select
            value={workflowFilter}
            onChange={(e) => setWorkflowFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">All workflows</option>
            {workflows.map((wf) => (
              <option key={wf.id} value={wf.id}>{wf.name}</option>
            ))}
          </select>
          <Button onClick={() => { setTriggerOpen(true); setSelectedWorkflow(workflows[0]?.id ?? ''); }}>
            <Play size={14} />
            Trigger
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : executions.length === 0 ? (
        <div className="table-container">
          <EmptyState
            icon={Play}
            title={statusFilter ? `No ${statusFilter.toLowerCase()} executions` : 'No executions yet'}
            description="Trigger a workflow to see executions appear here. The list refreshes every 5 seconds."
            action={workflows.length > 0 ? (
              <Button onClick={() => { setTriggerOpen(true); setSelectedWorkflow(workflows[0]?.id ?? ''); }}>
                Trigger Execution
              </Button>
            ) : undefined}
          />
        </div>
      ) : (
        <div className="table-container">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr>
                {['ID', 'Workflow', 'Status', 'Started', 'Duration', 'Created By'].map((h) => (
                  <th key={h} className="table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {executions.map((ex) => (
                <tr key={ex.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td">
                    <Link to={`/executions/${ex.id}`} className="text-xs font-mono text-brand-600 hover:underline">
                      {ex.id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="table-td text-gray-600">
                    {workflowMap[ex.workflowId] ?? `${ex.workflowId.slice(0, 8)}…`}
                  </td>
                  <td className="table-td"><StatusBadge status={ex.status} /></td>
                  <td className="table-td text-gray-500">{new Date(ex.startedAt).toLocaleString()}</td>
                  <td className="table-td text-gray-500">{duration(ex)}</td>
                  <td className="table-td text-gray-500">{ex.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={triggerOpen}
        onClose={() => setTriggerOpen(false)}
        title="Trigger Execution"
        size="sm"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Workflow</label>
            <select
              value={selectedWorkflow}
              onChange={(e) => setSelectedWorkflow(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              {workflows.map((wf) => (
                <option key={wf.id} value={wf.id}>{wf.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Input (JSON)</label>
            <textarea
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono h-28 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              spellCheck={false}
            />
            {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setTriggerOpen(false)}>Cancel</Button>
            <Button loading={triggering} onClick={handleTrigger} disabled={!selectedWorkflow}>
              Trigger
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
