import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { StepBottleneck } from '../../types';

interface Props {
  bottlenecks: StepBottleneck[];
}

export function StepDurationChart({ bottlenecks }: Props) {
  if (bottlenecks.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No bottleneck data</p>;
  }

  const data = bottlenecks.slice(0, 10).map((b) => ({
    name: b.step.length > 12 ? b.step.slice(0, 10) + '…' : b.step,
    avgMs: Math.round(b.avgDurationMs),
    maxMs: Math.round(b.maxDurationMs),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit="ms" />
        <Tooltip formatter={(v: number) => `${v}ms`} />
        <Bar dataKey="avgMs" name="Avg Duration" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="#f59e0b" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
