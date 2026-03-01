/**
 * Tests for Hero component microcopy
 */

import { render, screen } from '@testing-library/react'
import Hero from '@/components/Hero'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

// Mock analytics modules
jest.mock('@/lib/analytics/events', () => ({
  trackVehicleSearch: jest.fn(),
  trackFormSubmission: jest.fn(),
  trackReportWorkflow: jest.fn(),
}))
jest.mock('@/lib/analytics/reddit-events', () => ({
  trackRedditLead: jest.fn(),
}))

// Mock child components
jest.mock('@/components/ReportPreviewCondensed', () => () => <div data-testid="report-preview" />)

describe('Hero', () => {
  it('does not show "no credit card required" text', () => {
    render(<Hero />)
    expect(screen.queryByText(/no credit card/i)).not.toBeInTheDocument()
  })

  it('shows "Takes 60 seconds" microcopy', () => {
    render(<Hero />)
    expect(screen.getByText(/takes 60 seconds/i)).toBeInTheDocument()
  })
})
