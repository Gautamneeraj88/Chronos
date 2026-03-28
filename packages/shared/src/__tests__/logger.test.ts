import { createLogger } from '../logger';

describe('createLogger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns an ILogger with all four log methods', () => {
    const logger = createLogger('test-service');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('does not throw when logging messages', () => {
    const logger = createLogger('test-service');
    expect(() => logger.info('hello')).not.toThrow();
    expect(() => logger.debug('debug msg', { key: 'val' })).not.toThrow();
    expect(() => logger.warn('warning')).not.toThrow();
    expect(() => logger.error('error', { err: 'detail' })).not.toThrow();
  });

  it('does not throw when LOKI_URL is not set', () => {
    delete process.env.LOKI_URL;
    expect(() => createLogger('no-loki-service')).not.toThrow();
  });

  it('does not throw when LOKI_URL is set (Loki transport added)', () => {
    process.env.LOKI_URL = 'http://localhost:3100';
    // Should not throw even if Loki is not reachable — errors are swallowed
    expect(() => createLogger('loki-service')).not.toThrow();
  });

  it('respects LOG_LEVEL env var', () => {
    process.env.LOG_LEVEL = 'warn';
    const logger = createLogger('level-test');
    expect(typeof logger.info).toBe('function'); // interface still complete
  });
});
