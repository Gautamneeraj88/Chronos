import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Props {
  completed: number;
  failed: number;
  running: number;
}

const COLORS = { COMPLETED: '#22c55e', FAILED: '#ef4444', RUNNING: '#3b82f6' };

export function ExecutionStatusChart({ completed, failed, running }: Props) {
  const data = [
    { name: 'COMPLETED', value: completed },
    { name: 'FAILED', value: failed },
    { name: 'RUNNING', value: running },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
          {data.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS] ?? '#6b7280'} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
