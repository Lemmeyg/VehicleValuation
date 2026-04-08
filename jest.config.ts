import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  moduleNameMapper: {
    // Specific mocks must come before the general @/ catch-all — Jest uses first match.
    // @react-pdf/renderer uses ESM and cannot be parsed by Jest's CommonJS transform.
    '^@react-pdf/renderer$': '<rootDir>/__tests__/__mocks__/@react-pdf/renderer.ts',
    // Mock Supabase DB client to avoid requiring real env vars in unit tests.
    '^@/lib/db/supabase$': '<rootDir>/__tests__/__mocks__/lib/db/supabase.ts',
    // General @/ alias — must be last so specific overrides above are checked first.
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
    '<rootDir>/.worktrees/',
  ],
  testMatch: ['**/__tests__/**/*.test.{js,jsx,ts,tsx}'],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/types/**',
    '!**/__tests__/**',
    '!**/coverage/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  // Use test-specific env file
  setupFiles: ['<rootDir>/__tests__/env.setup.ts'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)
