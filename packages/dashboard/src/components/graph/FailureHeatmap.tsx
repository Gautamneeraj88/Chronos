import type { StepFailureStat } from '../../types';

interface Props {
  failures: StepFailureStat[];
}

function heatColor(count: number, max: number): string {
  if (max === 0) return 'bg-gray-100';
  const ratio = count / max;
  if (ratio >= 0.75) return 'bg-red-500 text-white';
  if (ratio >= 0.5)  return 'bg-red-300 text-red-900';
  if (ratio >= 0.25) return 'bg-orange-200 text-orange-900';
  return 'bg-yellow-100 text-yellow-800';
}

export function FailureHeatmap({ failures }: Props) {
  if (failures.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No failure data</p>;
  }

  const max = Math.max(...failures.map((f) => f.failureCount));

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
      {failures.map((f) => (
        <div
          key={f.step}
          className={`rounded p-3 flex flex-col gap-1 ${heatColor(f.failureCount, max)}`}
        >
          <span className="text-xs font-medium truncate" title={f.step}>{f.step}</span>
          <span className="text-xs opacity-70 font-mono truncate" title={f.activity}>{f.activity}</span>
          <span className="text-lg font-bold leading-none">{f.failureCount}</span>
          <span className="text-xs opacity-60">failures</span>
        </div>
      ))}
    </div>
  );
}
