import { Link } from 'react-router-dom';
import type { WorkflowDefinition } from '../../types';
import { Card, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';

interface Props {
  workflow: WorkflowDefinition;
  onTrigger?: (id: string) => void;
}

export function WorkflowCard({ workflow, onTrigger }: Props) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link
              to={`/workflows/${workflow.id}`}
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              {workflow.name}
            </Link>
            <p className="text-xs text-gray-400 mt-0.5">
              v{workflow.version} · {workflow.steps.length} steps
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Link to={`/workflows/${workflow.id}`}>
              <Button variant="ghost" className="text-xs">View</Button>
            </Link>
            {onTrigger && (
              <Button variant="secondary" className="text-xs" onClick={() => onTrigger(workflow.id)}>
                Trigger
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Created {new Date(workflow.createdAt).toLocaleDateString()}
        </p>
      </CardBody>
    </Card>
  );
}
