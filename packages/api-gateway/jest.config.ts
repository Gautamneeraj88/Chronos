export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.ts$'],
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts'],
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'], // ← add this
};
