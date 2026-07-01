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
  // Testes escritos para Vitest (frontend utils) — rodar com Vitest, não Jest
  testPathIgnorePatterns: [
    '/node_modules/',
    'use-url-hash-tab\\.test\\.ts$',
    'br-cep\\.util\\.test\\.ts$',
    'wa-location\\.util\\.test\\.ts$',
    'catalog-delivery\\.util\\.test\\.ts$',
    'catalog-delivery-location-confirm\\.test\\.ts$',
    'catalog-delivery-address\\.test\\.ts$',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Stub out Baileys and its native deps — tests mock the WhatsApp socket directly
    '^@whiskeysockets/baileys$': '<rootDir>/src/__mocks__/@whiskeysockets/baileys.ts',
  },
};
