import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { GitBranchPlus } from 'lucide-react';
import { listWorkflows } from '../../api/workflows';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { triggerExecution } from '../../api/executions';

export function WorkflowsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [triggerModal, setTriggerModal] = useState<string | null>(null);
  const [inputJson, setInputJson] = useState('{}');
  const [triggering, setTriggering] = useState(false);
  const [jsonError, setJsonError] = useState('');

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: listWorkflows,
  });

  const handleTrigger = async () => {
    if (!triggerModal) return;
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
      const ex = await triggerExecution(triggerModal, parsed);
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
      setTriggerModal(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Workflows <span className="text-gray-400 font-normal text-base">({workflows.length})</span></h2>
        {isAdmin && (
          <Link to="/workflows/new">
            <Button>
              <GitBranchPlus size={14} />
              New Workflow
            </Button>
          </Link>
        )}
      </div>

      {workflows.length === 0 ? (
        <div className="table-container">
          <EmptyState
            icon={GitBranchPlus}
            title="No workflows registered"
            description="Create your first workflow to start orchestrating distributed activities."
            action={isAdmin ? (
              <Link to="/workflows/new"><Button>New Workflow</Button></Link>
            ) : undefined}
          />
        </div>
      ) : (
        <div className="table-container">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr>
                {['Name', 'Version', 'Steps', 'Created', ''].map((h) => (
                  <th key={h} className="table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workflows.map((wf) => (
                <tr key={wf.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td">
                    <Link to={`/workflows/${wf.id}`} className="font-medium text-brand-600 hover:text-brand-700 transition-colors">
                      {wf.name}
                    </Link>
                  </td>
                  <td className="table-td text-gray-500">v{wf.version}</td>
                  <td className="table-td text-gray-500">{wf.steps.length} steps</td>
                  <td className="table-td text-gray-500">
                    {new Date(wf.createdAt).toLocaleDateString()}
                  </td>
                  <td className="table-td text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { setTriggerModal(wf.id); setInputJson('{}'); }}
                    >
                      Trigger
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!triggerModal}
        onClose={() => setTriggerModal(null)}
        title="Trigger Execution"
        description="Provide the workflow input as a JSON object."
        size="sm"
      >
        <div className="flex flex-col gap-3">
          <textarea
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono h-32 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            spellCheck={false}
          />
          {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setTriggerModal(null)}>Cancel</Button>
            <Button loading={triggering} onClick={handleTrigger}>Trigger</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
