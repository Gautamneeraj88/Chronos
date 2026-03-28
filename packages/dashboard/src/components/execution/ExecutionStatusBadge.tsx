import { StatusBadge } from '../ui/Badge';
import type { Execution } from '../../types';

interface Props {
  status: Execution['status'];
}

export function ExecutionStatusBadge({ status }: Props) {
  return <StatusBadge status={status} />;
}
