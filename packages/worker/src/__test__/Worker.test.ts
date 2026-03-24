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
  });

  describe('eachMessage — failure path', () => {
    beforeEach(async () => {
      await worker.start();
    });

    it('publishes failure result when activity throws', async () => {
      // Use an unregistered activity name to force a failure
      const payload = makePayload({
        activityName: 'nonExistentActivity',
        stepId: 'bad-step',
      });

      await mockEachMessageHandler(makeMessage(payload));

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      const result = JSON.parse(call.messages[0].value);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('does not throw when activity fails — consumer must stay alive', async () => {
      const payload = makePayload({ activityName: 'nonExistentActivity' });

      // Should not throw — a crash here would kill the consumer
      await expect(mockEachMessageHandler(makeMessage(payload))).resolves.not.toThrow();
    });
  });

  describe('eachMessage — edge cases', () => {
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

    it('does not publish when message is invalid JSON', async () => {
      await mockEachMessageHandler({
        message: { value: Buffer.from('not-json') },
        partition: 0,
        topic: TOPICS.STEP_EXECUTE,
      });

      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
