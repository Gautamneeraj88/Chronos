import { Worker } from '../worker';
import { KafkaClient } from '@chronos/kafka';
import { TOPICS } from '@chronos/kafka';
import { StepExecuteMessage } from '@chronos/shared';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSend = jest.fn().mockResolvedValue(undefined);
const mockProducer = { send: mockSend };

const mockEachMessageHandler = jest.fn();
const mockRun = jest.fn().mockImplementation(({ eachMessage }) => {
  mockEachMessageHandler.mockImplementation(eachMessage);
  return Promise.resolve();
});
const mockSubscribe = jest.fn().mockResolvedValue(undefined);
const mockConsumer = { subscribe: mockSubscribe, run: mockRun };

const mockGetProducer = jest.fn().mockResolvedValue(mockProducer);
const mockGetConsumer = jest.fn().mockResolvedValue(mockConsumer);

jest.mock('@chronos/kafka', () => ({
  KafkaClient: jest.fn().mockImplementation(() => ({
    getProducer: mockGetProducer,
    getConsumer: mockGetConsumer,
  })),
  TOPICS: {
    STEP_EXECUTE: 'chronos.step.execute',
    STEP_RESULT: 'chronos.step.result',
    STEP_DLQ: 'chronos.step.dlq',
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMessage(payload: StepExecuteMessage) {
  return {
    message: { value: Buffer.from(JSON.stringify(payload)) },
    partition: 0,
    topic: TOPICS.STEP_EXECUTE,
  };
}

function makePayload(overrides: Partial<StepExecuteMessage> = {}): StepExecuteMessage {
  return {
    executionId: 'exec-123',
    workflowId: 'wf-456',
    stepId: 'charge-card',
    activityName: 'chargeCard',
    input: { orderId: 'ord-001', amount: 99.99 },
    attemptNumber: 1,
    retries: 3,
    timeoutMs: 30_000,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Worker', () => {
  let worker: Worker;
  let kafkaClient: KafkaClient;

  beforeEach(() => {
    jest.clearAllMocks();
    kafkaClient = { getProducer: mockGetProducer, getConsumer: mockGetConsumer } as unknown as KafkaClient;
    worker = new Worker(kafkaClient, 'test-worker-1');
  });

  describe('start()', () => {
    it('subscribes to STEP_EXECUTE topic with correct group', async () => {
      await worker.start();

      expect(mockGetConsumer).toHaveBeenCalledWith('chronos-workers');
      expect(mockSubscribe).toHaveBeenCalledWith({
        topic: TOPICS.STEP_EXECUTE,
        fromBeginning: false,
      });
      expect(mockRun).toHaveBeenCalled();
    });

    it('connects a producer on start', async () => {
      await worker.start();
      expect(mockGetProducer).toHaveBeenCalled();
    });
  });

  describe('eachMessage — success path', () => {
    beforeEach(async () => {
      await worker.start();
    });

    it('publishes success result when activity succeeds', async () => {
      const payload = makePayload({ activityName: 'chargeCard', stepId: 'charge-card' });

      await mockEachMessageHandler(makeMessage(payload));

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.topic).toBe(TOPICS.STEP_RESULT);

      const result = JSON.parse(call.messages[0].value);
      expect(result.executionId).toBe('exec-123');
      expect(result.stepId).toBe('charge-card');
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('uses executionId as the Kafka message key', async () => {
      const payload = makePayload();

      await mockEachMessageHandler(makeMessage(payload));

      const call = mockSend.mock.calls[0][0];
      expect(call.messages[0].key).toBe('exec-123');
    });

    it('publishes success when activity succeeds on attempt 2 (after retry)', async () => {
      // Simulates: worker receives a step with attemptNumber=2 (re-published by a prior failed attempt)
      const payload = makePayload({ stepId: 'charge-card', activityName: 'chargeCard', attemptNumber: 2, retries: 3 });

      await mockEachMessageHandler(makeMessage(payload));

      const call = mockSend.mock.calls[0][0];
      expect(call.topic).toBe(TOPICS.STEP_RESULT);
      const result = JSON.parse(call.messages[0].value);
      expect(result.success).toBe(true);
      expect(result.stepId).toBe('charge-card');
    });
  });

  describe('eachMessage — failure + retry path', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await worker.start();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('re-publishes to STEP_EXECUTE with attemptNumber+1 when retries remain', async () => {
      const payload = makePayload({
        activityName: 'nonExistentActivity',
        stepId: 'bad-step',  // not in registry → throws immediately, no withTimeout delay
        attemptNumber: 1,
        retries: 3,
      });

      const handlerPromise = mockEachMessageHandler(makeMessage(payload));
      // runAllTimersAsync interleaves timer advancement with promise resolution,
      // so it fires the retry setTimeout even though it's registered after an await.
      await jest.runAllTimersAsync();
      await handlerPromise;

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.topic).toBe(TOPICS.STEP_EXECUTE);

      const retried = JSON.parse(call.messages[0].value);
      expect(retried.attemptNumber).toBe(2);
      expect(retried.stepId).toBe('bad-step');
    });

    it('publishes failure to STEP_RESULT when all retries exhausted', async () => {
      const payload = makePayload({
        activityName: 'nonExistentActivity',
        stepId: 'bad-step',  // not in registry → immediate throw, no timer needed
        attemptNumber: 4,
        retries: 3,
      });

      await mockEachMessageHandler(makeMessage(payload));

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.topic).toBe(TOPICS.STEP_RESULT);

      const result = JSON.parse(call.messages[0].value);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('does not throw when activity fails — consumer must stay alive', async () => {
      // stepId 'bad-step' is not in the registry → immediate ActivityError, no timer
      const payload = makePayload({ activityName: 'nonExistentActivity', stepId: 'bad-step', retries: 0 });

      await expect(mockEachMessageHandler(makeMessage(payload))).resolves.not.toThrow();
    });

    it('backoff delay doubles: 1000ms on attempt 1, 2000ms on attempt 2', async () => {
      // Attempt 1 → delay = min(1000 * 2^0, 30000) = 1000ms
      const p1 = mockEachMessageHandler(makeMessage(
        makePayload({ stepId: 'bad-step', activityName: 'nonExistentActivity', attemptNumber: 1, retries: 3 }),
      ));
      await jest.advanceTimersByTimeAsync(999);
      expect(mockSend).not.toHaveBeenCalled();   // retry not fired yet
      await jest.advanceTimersByTimeAsync(1);
      await p1;
      expect(mockSend).toHaveBeenCalledTimes(1); // fired at exactly 1000ms

      jest.clearAllMocks();

      // Attempt 2 → delay = min(1000 * 2^1, 30000) = 2000ms
      const p2 = mockEachMessageHandler(makeMessage(
        makePayload({ stepId: 'bad-step', activityName: 'nonExistentActivity', attemptNumber: 2, retries: 3 }),
      ));
      await jest.advanceTimersByTimeAsync(1999);
      expect(mockSend).not.toHaveBeenCalled();   // retry not fired yet
      await jest.advanceTimersByTimeAsync(1);
      await p2;
      expect(mockSend).toHaveBeenCalledTimes(1); // fired at exactly 2000ms
    });
  });

  describe('eachMessage — DLQ routing', () => {
    beforeEach(async () => {
      await worker.start();
    });

    it('does not publish when message value is null', async () => {
      await mockEachMessageHandler({
        message: { value: null },
        partition: 0,
        topic: TOPICS.STEP_EXECUTE,
      });

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('sends unparseable message to DLQ instead of dropping', async () => {
      await mockEachMessageHandler({
        message: { value: Buffer.from('not-json') },
        partition: 0,
        topic: TOPICS.STEP_EXECUTE,
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.topic).toBe(TOPICS.STEP_DLQ);

      const dlq = JSON.parse(call.messages[0].value);
      expect(dlq.originalTopic).toBe(TOPICS.STEP_EXECUTE);
      expect(dlq.originalPayload).toBe('not-json');
      expect(dlq.reason).toBe('JSON parse error');
      expect(dlq.failedAt).toBeDefined();
    });
  });
});
