import type { StepBottleneck } from '../../types';

interface Props {
  bottlenecks: StepBottleneck[];
}

export function BottleneckTable({ bottlenecks }: Props) {
  if (bottlenecks.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No bottleneck data</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Step', 'Activity', 'Avg Duration', 'Max Duration', 'Executions'].map((h) => (
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
          {bottlenecks.map((b) => (
            <tr key={b.step} className="hover:bg-gray-50">
              <td className="px-4 py-2 font-medium text-gray-800">{b.step}</td>
              <td className="px-4 py-2 font-mono text-gray-500 text-xs">{b.activity}</td>
              <td className="px-4 py-2 text-gray-600">{Math.round(b.avgDurationMs)}ms</td>
              <td className="px-4 py-2 text-gray-600">{Math.round(b.maxDurationMs)}ms</td>
              <td className="px-4 py-2 text-gray-500">{b.executionCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
