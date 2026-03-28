import type { WorkflowStep } from '../../types';

interface Props {
  steps: WorkflowStep[];
}

export function WorkflowStepList({ steps }: Props) {
  if (steps.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">No steps defined.</p>;
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          {['#', 'Name', 'Activity', 'Retries', 'Timeout', 'Compensation'].map((h) => (
            <th
              key={h}
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {steps.map((step, i) => (
          <tr key={step.name} className="hover:bg-gray-50">
            <td className="px-4 py-2 text-sm text-gray-400">{i + 1}</td>
            <td className="px-4 py-2 text-sm font-medium text-gray-800">{step.name}</td>
            <td className="px-4 py-2 text-sm font-mono text-gray-600">{step.activity}</td>
            <td className="px-4 py-2 text-sm text-gray-500">{step.retries}</td>
            <td className="px-4 py-2 text-sm text-gray-500">{step.timeoutMs}ms</td>
            <td className="px-4 py-2 text-sm text-gray-400">{step.compensation ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
