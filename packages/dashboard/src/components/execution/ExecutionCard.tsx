import { Link } from 'react-router-dom';
import { Card, CardBody } from '../ui/Card';
import { ExecutionStatusBadge } from './ExecutionStatusBadge';
import type { Execution } from '../../types';

interface Props {
  execution: Execution;
}

export function ExecutionCard({ execution }: Props) {
  const duration = execution.completedAt
    ? `${((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000).toFixed(1)}s`
    : 'In progress…';

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/executions/${execution.id}`}
              className="text-sm font-mono text-brand-600 hover:text-brand-700 truncate block"
            >
              {execution.id.slice(0, 16)}…
            </Link>
            <p className="text-xs text-gray-400 mt-0.5">
              Workflow: {execution.workflowId.slice(0, 8)}… · v{execution.workflowVersion}
            </p>
          </div>
          <ExecutionStatusBadge status={execution.status} />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
          <span>Started {new Date(execution.startedAt).toLocaleString()}</span>
          <span>Duration: {duration}</span>
        </div>
        {execution.error && (
          <p className="text-xs text-red-500 mt-1 truncate">Error: {execution.error}</p>
        )}
      </CardBody>
    </Card>
  );
}
