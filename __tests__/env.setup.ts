/**
 * Environment Setup for Tests
 *
 * Loads .env.test file before any tests run
 * Sets critical environment variables for test environment
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.test file
dotenv.config({ path: path.resolve(__dirname, '../.env.test') })

// Override any environment variables that might have been set
process.env.NODE_ENV = 'test'
process.env.ENABLE_API_MOCKS = 'true'
process.env.ALLOW_REAL_API_CALLS_IN_TESTS = 'false'

// Ensure test environment is properly configured
if (process.env.NODE_ENV !== 'test') {
  throw new Error('Tests must run with NODE_ENV=test')
}
