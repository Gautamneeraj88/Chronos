import type { DomainEvent } from '../../types';

const EVENT_LABELS: Record<string, string> = {
  EXECUTION_STARTED:      'Execution started',
  EXECUTION_COMPLETED:    'Execution completed',
  EXECUTION_FAILED:       'Execution failed',
  STEP_STARTED:           'Step started',
  STEP_IN_FLIGHT:         'Dispatched to worker',
  STEP_COMPLETED:         'Step completed',
  STEP_FAILED:            'Step failed',
  COMPENSATION_STARTED:   'Compensation started',
  COMPENSATION_COMPLETED: 'Compensation completed',
  COMPENSATION_FAILED:    'Compensation failed',
};

const EVENT_COLOR: Record<string, string> = {
  EXECUTION_COMPLETED:    'text-green-600 bg-green-50 border-green-200',
  EXECUTION_FAILED:       'text-red-600 bg-red-50 border-red-200',
  STEP_FAILED:            'text-red-600 bg-red-50 border-red-200',
  STEP_COMPLETED:         'text-green-600 bg-green-50 border-green-200',
  COMPENSATION_STARTED:   'text-orange-600 bg-orange-50 border-orange-200',
  COMPENSATION_COMPLETED: 'text-orange-600 bg-orange-50 border-orange-200',
  COMPENSATION_FAILED:    'text-red-600 bg-red-50 border-red-200',
};

function TimelineItem({ event, prev }: { event: DomainEvent; prev?: DomainEvent }) {
  const delta = prev
    ? `+${((new Date(event.occurredAt).getTime() - new Date(prev.occurredAt).getTime()) / 1000).toFixed(2)}s`
    : null;

  const colorCls = EVENT_COLOR[event.type] ?? 'text-gray-600 bg-gray-50 border-gray-200';

  return (
    <div className={`flex gap-3 border rounded p-3 ${colorCls}`}>
      <div className="flex flex-col items-center gap-1 min-w-[80px]">
        <span className="text-xs font-mono">{new Date(event.occurredAt).toLocaleTimeString()}</span>
        {delta && <span className="text-xs opacity-60">{delta}</span>}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{EVENT_LABELS[event.type] ?? event.type}</span>
        {event.stepName && <span className="text-xs opacity-70">step: {event.stepName}</span>}
        {!!event.payload?.error && (
          <span className="text-xs text-red-500">{String(event.payload.error)}</span>
        )}
      </div>
    </div>
  );
}

interface Props {
  events: DomainEvent[];
  isLoading?: boolean;
}

export function ExecutionTimeline({ events, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-14 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-sm text-gray-500">No events yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {events.map((ev, i) => (
        <TimelineItem key={ev.id} event={ev} prev={events[i - 1]} />
      ))}
    </div>
  );
}
