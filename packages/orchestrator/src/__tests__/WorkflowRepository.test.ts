import { MongoWorkflowRepository } from '../repositories/WorkflowRepository';

const repo = new MongoWorkflowRepository();

describe('MongoWorkflowRepository', () => {

  describe('save', () => {
    it('creates a workflow and returns it with an id', async () => {
      const result = await repo.save({
        name: 'order-processing',
        steps: [
          { name: 'charge-card', type: 'activity', retries: 3, timeoutMs: 5000, compensation: 'refund-card' },
          { name: 'refund-card', type: 'activity', retries: 3, timeoutMs: 5000, compensation: null },
        ],
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('order-processing');
      expect(result.version).toBe(1);
      expect(result.steps).toHaveLength(2);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('throws ConflictError if workflow name already exists', async () => {
      await repo.save({
        name: 'duplicate-workflow',
        steps: [{ name: 'step-1', type: 'activity', retries: 3, timeoutMs: 5000, compensation: null }],
      });

      await expect(
        repo.save({
          name: 'duplicate-workflow',
          steps: [{ name: 'step-1', type: 'activity', retries: 3, timeoutMs: 5000, compensation: null }],
        })
      ).rejects.toThrow('already exists');
    });
  });

  describe('findById', () => {
    it('returns null for unknown id', async () => {
      const result = await repo.findById('non-existent-id');
      expect(result).toBeNull();
    });

    it('returns the workflow when found', async () => {
      const saved = await repo.save({
        name: 'find-me',
        steps: [{ name: 'step-1', type: 'activity', retries: 3, timeoutMs: 5000, compensation: null }],
      });

      const found = await repo.findById(saved.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('find-me');
    });
  });
});
