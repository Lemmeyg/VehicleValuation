/**
 * Tests for the Testimonials bottom form
 *
 * VIN/mileage/ZIP only — no email field (email is optional on
 * /api/reports/create-anonymous and is collected by LemonSqueezy at checkout).
 *
 * Like Hero, this form creates the report server-side at submit time and hands
 * it to /pricing via sessionStorage.pending_report. It previously wrote the raw
 * fields to localStorage.hero_form_data instead — a key nothing reads — so every
 * submission dead-ended on "No vehicle data found".
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
  getPostHogDistinctId: jest.fn(() => 'ph-distinct-1'),
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
    sessionStorage.clear()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ report: { id: 'report-1' } }),
    })
  })

  it('creates the report server-side and hands it to /pricing via sessionStorage', async () => {
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

    // The form must actually create the report, not just stash fields locally.
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/reports/create-anonymous',
      expect.objectContaining({ method: 'POST' })
    )

    // /pricing reads sessionStorage.pending_report — nothing reads hero_form_data.
    expect(JSON.parse(sessionStorage.getItem('pending_report') ?? 'null')).toEqual({
      id: 'report-1',
    })
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

  it('does not write the dead hero_form_data key that /pricing never reads', async () => {
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

    expect(localStorageMock.getItem('hero_form_data')).toBeNull()
  })

  it('shows an error and stays on the page when report creation fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'VIN not found' }),
    })

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

    expect(await screen.findByText('VIN not found')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
