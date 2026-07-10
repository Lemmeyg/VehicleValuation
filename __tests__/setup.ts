/**
 * Global Test Setup
 *
 * Configures mocks and test environment for all tests
 * CRITICAL: Prevents real API calls to avoid costs
 */

import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.ENABLE_API_MOCKS = 'true'
process.env.ALLOW_REAL_API_CALLS_IN_TESTS = 'false'

// Polyfill Web APIs for Node environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.TextEncoder = TextEncoder as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.TextDecoder = TextDecoder as any

// Polyfill Headers for Next.js
if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers {
    private headers: Map<string, string>

    constructor(init?: Record<string, string>) {
      this.headers = new Map(Object.entries(init || {}))
    }

    get(name: string): string | null {
      return this.headers.get(name.toLowerCase()) || null
    }

    set(name: string, value: string): void {
      this.headers.set(name.toLowerCase(), value)
    }

    has(name: string): boolean {
      return this.headers.has(name.toLowerCase())
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// Polyfill Request for Next.js route handlers in Node environment
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    url: string
    method: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    headers: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(url: string, init?: any) {
      this.url = url
      this.method = init?.method || 'GET'
      this.headers = new (global.Headers || Map)(init?.headers || {})
      this.body = init?.body
    }

    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body)
      }
      return this.body
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// Polyfill Response for Next.js route handlers
if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    status: number
    statusText: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    headers: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(body?: any, init?: any) {
      this.body = body
      this.status = init?.status || 200
      this.statusText = init?.statusText || 'OK'
      this.headers = new (global.Headers || Map)(init?.headers || {})
    }

    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body)
      }
      return this.body
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// Mock fetch globally to catch any unmocked API calls
const originalFetch = global.fetch
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.fetch = jest.fn((url: any, options?: any) => {
  // If this is a real API call that wasn't mocked, throw error
  const urlString = typeof url === 'string' ? url : url.toString()

  // Allow localhost calls (for testing endpoints)
  if (urlString.includes('localhost') || urlString.includes('127.0.0.1')) {
    return originalFetch(url, options)
  }

  // Block real external API calls
  if (process.env.ALLOW_REAL_API_CALLS_IN_TESTS !== 'true') {
    throw new Error(
      `❌ BLOCKED: Real API call attempted in tests!\n` +
        `URL: ${urlString}\n` +
        `This would cost money. Use mocks instead.\n` +
        `See __tests__/mocks/ for mock utilities.`
    )
  }

  return originalFetch(url, options)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any

// Mock console methods to reduce noise in tests (optional)
global.console = {
  ...console,
  // Uncomment to silence logs during tests:
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // Keep errors and warnings visible:
  error: console.error,
  warn: console.warn,
}

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks()
})
