import { render, screen } from '@testing-library/react';
import { ExecutionTimeline } from '../components/execution/ExecutionTimeline';
import type { DomainEvent } from '../types';

function makeEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: 'ev-1',
    executionId: 'exec-1',
    type: 'STEP_COMPLETED',
    stepName: 'step-a',
    payload: {},
    occurredAt: '2026-03-25T10:00:00.000Z',
    ...overrides,
  };
}

describe('ExecutionTimeline', () => {
  it('shows loading skeletons when isLoading is true', () => {
    const { container } = render(<ExecutionTimeline events={[]} isLoading />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when there are no events', () => {
    render(<ExecutionTimeline events={[]} />);
    expect(screen.getByText('No events yet.')).toBeInTheDocument();
  });

  it('renders a timeline item for each event', () => {
    const events: DomainEvent[] = [
      makeEvent({ id: 'ev-1', type: 'EXECUTION_STARTED', stepName: null }),
      makeEvent({ id: 'ev-2', type: 'STEP_COMPLETED', stepName: 'step-a', occurredAt: '2026-03-25T10:00:05.000Z' }),
    ];
    render(<ExecutionTimeline events={events} />);
    expect(screen.getByText('Execution started')).toBeInTheDocument();
    expect(screen.getByText('Step completed')).toBeInTheDocument();
    expect(screen.getByText('step: step-a')).toBeInTheDocument();
  });

  it('shows delta time between events', () => {
    const events: DomainEvent[] = [
      makeEvent({ id: 'ev-1', type: 'EXECUTION_STARTED', occurredAt: '2026-03-25T10:00:00.000Z' }),
      makeEvent({ id: 'ev-2', type: 'STEP_COMPLETED', occurredAt: '2026-03-25T10:00:02.500Z' }),
    ];
    render(<ExecutionTimeline events={events} />);
    expect(screen.getByText('+2.50s')).toBeInTheDocument();
  });

  it('displays error payload text for failed events', () => {
    const events: DomainEvent[] = [
      makeEvent({ id: 'ev-1', type: 'STEP_FAILED', payload: { error: 'timeout exceeded' } }),
    ];
    render(<ExecutionTimeline events={events} />);
    expect(screen.getByText('timeout exceeded')).toBeInTheDocument();
  });
});
