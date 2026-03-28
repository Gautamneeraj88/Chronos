import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.integration.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 15_000,
  forceExit: true,
};

export default config;
