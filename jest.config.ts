import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  forceExit: true,
  detectOpenHandles: false,
  // Only run tests under apps to keep scope tight
  testMatch: [
    '<rootDir>/apps/**/tests/**/*.test.ts',
  ],
  roots: ['<rootDir>'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/apps/api/tests/setup.ts'],
};

export default config;
