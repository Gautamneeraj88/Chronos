import { TimeoutChecker } from '../services/TimeoutChecker';
import { ITimeoutStore } from '../timeouts/ITimeoutStore';
import { ExecutionService } from '../services/ExecutionService';

function makeTimeoutStore(expired: Array<{ executionId: string; stepId: string }> = []): ITimeoutStore {
  return {
    schedule: jest.fn(),
    cancel: jest.fn(),
    consumeExpired: jest.fn().mockResolvedValue(expired),
  };
}

function makeExecutionService(): jest.Mocked<Pick<ExecutionService, 'handleStepResult'>> {
  return { handleStepResult: jest.fn().mockResolvedValue(undefined) };
}

describe('TimeoutChecker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls consumeExpired on each poll cycle', async () => {
    const store = makeTimeoutStore([]);
    const svc = makeExecutionService();
    const checker = new TimeoutChecker(store, svc as unknown as ExecutionService);

    checker.start();
    await jest.advanceTimersByTimeAsync(1000);
    checker.stop();

    expect(store.consumeExpired).toHaveBeenCalledTimes(1);
  });

  it('injects a failure for each expired entry', async () => {
    const expired = [
      { executionId: 'exec-1', stepId: 'step-a' },
      { executionId: 'exec-2', stepId: 'step-b' },
    ];
    const store = makeTimeoutStore(expired);
    const svc = makeExecutionService();
    const checker = new TimeoutChecker(store, svc as unknown as ExecutionService);

    checker.start();
    await jest.advanceTimersByTimeAsync(1000);
    checker.stop();

    expect(svc.handleStepResult).toHaveBeenCalledTimes(2);
    expect(svc.handleStepResult).toHaveBeenCalledWith({
      executionId: 'exec-1',
      stepId: 'step-a',
      success: false,
      output: {},
      error: "Step 'step-a' timed out",
    });
    expect(svc.handleStepResult).toHaveBeenCalledWith({
      executionId: 'exec-2',
      stepId: 'step-b',
      success: false,
      output: {},
      error: "Step 'step-b' timed out",
    });
  });

  it('does not start a second timer if already running', async () => {
    const store = makeTimeoutStore([]);
    const svc = makeExecutionService();
    const checker = new TimeoutChecker(store, svc as unknown as ExecutionService);

    checker.start();
    checker.start(); // second call should be a no-op

    await jest.advanceTimersByTimeAsync(1000);
    checker.stop();

    // Only one interval should have fired
    expect(store.consumeExpired).toHaveBeenCalledTimes(1);
  });

  it('stops polling after stop() is called', async () => {
    const store = makeTimeoutStore([]);
    const svc = makeExecutionService();
    const checker = new TimeoutChecker(store, svc as unknown as ExecutionService);

    checker.start();
    await jest.advanceTimersByTimeAsync(1000);

    checker.stop();
    await jest.advanceTimersByTimeAsync(3000); // advance further — no more polls expected

    expect(store.consumeExpired).toHaveBeenCalledTimes(1);
  });
});
