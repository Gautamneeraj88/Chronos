import { ResultConsumer } from '../services/ResultConsumer';
import { KafkaClient, TOPICS } from '@chronos/kafka';
import { ExecutionService } from '../services/ExecutionService';

// ── Kafka mocks ───────────────────────────────────────────────────────────────

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
  KafkaClient: jest.fn(),
  TOPICS: {
    STEP_EXECUTE: 'chronos.step.execute',
    STEP_RESULT: 'chronos.step.result',
    STEP_DLQ: 'chronos.step.dlq',
  },
}));

// ── ExecutionService mock ─────────────────────────────────────────────────────

const mockHandleStepResult = jest.fn().mockResolvedValue(undefined);
const mockExecutionService = {
  handleStepResult: mockHandleStepResult,
} as unknown as ExecutionService;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMessage(value: string | null) {
  return {
    message: { value: value !== null ? Buffer.from(value) : null },
    partition: 0,
    topic: TOPICS.STEP_RESULT,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ResultConsumer', () => {
  let consumer: ResultConsumer;
  let kafkaClient: KafkaClient;

  beforeEach(async () => {
    jest.clearAllMocks();
    kafkaClient = {
      getProducer: mockGetProducer,
      getConsumer: mockGetConsumer,
    } as unknown as KafkaClient;

    consumer = new ResultConsumer(kafkaClient, mockExecutionService);
    await consumer.start();
  });

  describe('happy path', () => {
    it('forwards a valid result to ExecutionService', async () => {
      const payload = JSON.stringify({
        executionId: 'exec-1',
        stepId: 'charge-card',
        success: true,
        output: { charged: true },
      });

      await mockEachMessageHandler(makeMessage(payload));

      expect(mockHandleStepResult).toHaveBeenCalledTimes(1);
      expect(mockHandleStepResult).toHaveBeenCalledWith(
        expect.objectContaining({ executionId: 'exec-1', success: true }),
      );
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('DLQ routing', () => {
    it('sends unparseable message to DLQ and does not call ExecutionService', async () => {
      await mockEachMessageHandler(makeMessage('not-valid-json'));

      expect(mockHandleStepResult).not.toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledTimes(1);

      const call = mockSend.mock.calls[0][0];
      expect(call.topic).toBe(TOPICS.STEP_DLQ);

      const dlq = JSON.parse(call.messages[0].value);
      expect(dlq.originalTopic).toBe(TOPICS.STEP_RESULT);
      expect(dlq.originalPayload).toBe('not-valid-json');
      expect(dlq.reason).toBe('JSON parse error');
      expect(dlq.failedAt).toBeDefined();
    });

    it('does not send to DLQ for empty messages — just drops them', async () => {
      await mockEachMessageHandler(makeMessage(null));

      expect(mockSend).not.toHaveBeenCalled();
      expect(mockHandleStepResult).not.toHaveBeenCalled();
    });

    it('does not send to DLQ when ExecutionService throws — error is swallowed', async () => {
      mockHandleStepResult.mockRejectedValueOnce(new Error('DB unavailable'));

      const payload = JSON.stringify({
        executionId: 'exec-2',
        stepId: 'charge-card',
        success: false,
        output: {},
      });

      // Should not throw — consumer must stay alive
      await expect(mockEachMessageHandler(makeMessage(payload))).resolves.not.toThrow();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
