/**
 * Tests for the Testimonials bottom form
 *
 * Verifies it matches Hero form behaviour: no email field,
 * VIN/mileage/ZIP only, stores to localStorage, redirects to /pricing.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Testimonials from '@/components/Testimonials'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/lib/analytics/events', () => ({
  trackVehicleSearch: jest.fn(),
  trackFormSubmission: jest.fn(),
  trackReportWorkflow: jest.fn(),
}))
jest.mock('@/lib/analytics/reddit-events', () => ({
  trackRedditLead: jest.fn(),
}))

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = val
    },
    clear: () => {
      store = {}
    },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('Testimonials bottom form', () => {
  beforeEach(() => {
    mockPush.mockClear()
    localStorageMock.clear()
  })

  it('does not render an email field', () => {
    render(<Testimonials />)
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  })

  it('renders VIN, mileage, and ZIP fields', () => {
    render(<Testimonials />)
    expect(screen.getByLabelText('VIN', { exact: true })).toBeInTheDocument()
    expect(screen.getByLabelText('Mileage', { exact: true })).toBeInTheDocument()
    expect(screen.getByLabelText('ZIP Code', { exact: true })).toBeInTheDocument()
  })

  it('stores form data in localStorage and redirects to /pricing on valid submit', async () => {
    render(<Testimonials />)

    fireEvent.change(screen.getByPlaceholderText('1HGCM82633A123456'), {
      target: { value: '1HGCM82633A004352' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g., 42000'), {
      target: { value: '42000' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g., 90210'), {
      target: { value: '90210' },
    })

    fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/pricing')
    })

    const stored = JSON.parse(localStorageMock.getItem('hero_form_data') ?? '{}')
    expect(stored.vin).toBe('1HGCM82633A004352')
    expect(stored.mileage).toBe(42000)
    expect(stored.zipCode).toBe('90210')
  })
})
