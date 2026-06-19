module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testTimeout: 30000,
  forceExit: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Stub out Baileys and its native deps — tests mock the WhatsApp socket directly
    '^@whiskeysockets/baileys$': '<rootDir>/src/__mocks__/@whiskeysockets/baileys.ts',
  },
};
