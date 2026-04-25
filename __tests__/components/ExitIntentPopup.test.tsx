import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ExitIntentPopup from '@/components/ExitIntentPopup'

jest.mock('@/lib/analytics/events', () => ({
  trackEvent: jest.fn(),
}))

import { trackEvent } from '@/lib/analytics/events'
const mockTrackEvent = trackEvent as jest.MockedFunction<typeof trackEvent>

const mockFetch = jest.fn()
global.fetch = mockFetch

const defaultProps = {
  vin: '1HGBH41JXMN109186',
  reportId: 'report-1',
  onSelectPlan: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ count: 1 }),
  })
})

describe('ExitIntentPopup', () => {
  it('does not render the popup on mount', () => {
    render(<ExitIntentPopup {...defaultProps} />)
    expect(screen.queryByText(/get your report for \$19/i)).not.toBeInTheDocument()
  })

  it('shows popup after mouseleave with clientY <= 0 and count === 1', async () => {
    render(<ExitIntentPopup {...defaultProps} />)

    await act(async () => {
      fireEvent(document, new MouseEvent('mouseleave', { clientY: 0, bubbles: true }))
    })

    await waitFor(() => {
      expect(screen.getByText(/wait — get your report for \$19 today/i)).toBeInTheDocument()
    })
  })

  it('does not show popup when mouseleave clientY > 0', async () => {
    render(<ExitIntentPopup {...defaultProps} />)

    await act(async () => {
      fireEvent(document, new MouseEvent('mouseleave', { clientY: 10, bubbles: true }))
    })

    expect(screen.queryByText(/get your report for \$19/i)).not.toBeInTheDocument()
  })

  it('does not show popup when VIN count > 1', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 2 }),
    })

    render(<ExitIntentPopup {...defaultProps} />)

    await act(async () => {
      fireEvent(document, new MouseEvent('mouseleave', { clientY: 0, bubbles: true }))
    })

    expect(screen.queryByText(/get your report for \$19/i)).not.toBeInTheDocument()
  })

  it('does not show popup when exit_popup_shown is set in sessionStorage', async () => {
    sessionStorage.setItem('exit_popup_shown', 'true')

    render(<ExitIntentPopup {...defaultProps} />)

    await act(async () => {
      fireEvent(document, new MouseEvent('mouseleave', { clientY: 0, bubbles: true }))
    })

    expect(screen.queryByText(/get your report for \$19/i)).not.toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('tracks exit_intent_popup_shown when popup is displayed', async () => {
    render(<ExitIntentPopup {...defaultProps} />)

    await act(async () => {
      fireEvent(document, new MouseEvent('mouseleave', { clientY: 0, bubbles: true }))
    })

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('exit_intent_popup_shown', {
        reportId: 'report-1',
        vin: '1HGBH41JXMN109186',
      })
    })
  })

  it('calls onSelectPlan with discount code and tracks converted on CTA click', async () => {
    const onSelectPlan = jest.fn()
    render(<ExitIntentPopup {...defaultProps} onSelectPlan={onSelectPlan} />)

    await act(async () => {
      fireEvent(document, new MouseEvent('mouseleave', { clientY: 0, bubbles: true }))
    })

    await waitFor(() => screen.getByText(/get my report — \$19/i))

    fireEvent.click(screen.getByText(/get my report — \$19/i))

    expect(mockTrackEvent).toHaveBeenCalledWith('exit_intent_popup_converted', {
      reportId: 'report-1',
      vin: '1HGBH41JXMN109186',
    })
    expect(onSelectPlan).toHaveBeenCalledWith(expect.any(String))
  })

  it('dismisses popup and tracks dismissed on X button click', async () => {
    render(<ExitIntentPopup {...defaultProps} />)

    await act(async () => {
      fireEvent(document, new MouseEvent('mouseleave', { clientY: 0, bubbles: true }))
    })

    await waitFor(() => screen.getByLabelText(/close/i))
    fireEvent.click(screen.getByLabelText(/close/i))

    expect(screen.queryByText(/get your report for \$19/i)).not.toBeInTheDocument()
    expect(mockTrackEvent).toHaveBeenCalledWith('exit_intent_popup_dismissed', {
      reportId: 'report-1',
      vin: '1HGBH41JXMN109186',
    })
  })

  it('sets exit_popup_shown in sessionStorage when popup is shown', async () => {
    render(<ExitIntentPopup {...defaultProps} />)

    await act(async () => {
      fireEvent(document, new MouseEvent('mouseleave', { clientY: 0, bubbles: true }))
    })

    await waitFor(() => {
      expect(sessionStorage.getItem('exit_popup_shown')).toBe('true')
    })
  })
})
