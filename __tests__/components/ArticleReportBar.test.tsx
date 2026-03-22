/**
 * Tests for ArticleReportBar component
 *
 * Covers: render, value-prop ticker, form validation, auth modal trigger,
 * successful submission flow, and PostHog analytics event.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { ArticleReportBar } from '@/components/ArticleReportBar'
import { useAuth } from '@/hooks/useAuth'

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }))
jest.mock('posthog-js', () => ({ __loaded: true, capture: jest.fn() }))
jest.mock('@/components/AuthModal', () => ({
  __esModule: true,
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="auth-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}))

const mockPush = jest.fn()
const mockPosthog = posthog as jest.Mocked<typeof posthog>

function setupMocks({ loggedIn = false } = {}) {
  ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
  ;(useAuth as jest.Mock).mockReturnValue({ user: loggedIn ? { id: 'user-1' } : null })
}

const VALID_VIN = '1HGBH41JXMN109186'
const VALID_MILEAGE = '42000'
const VALID_ZIP = '90210'

async function fillForm() {
  await userEvent.type(screen.getByPlaceholderText(/1HGCM82633A123456/i), VALID_VIN)
  await userEvent.type(screen.getByPlaceholderText(/42,000/i), VALID_MILEAGE)
  await userEvent.type(screen.getByPlaceholderText(/90210/i), VALID_ZIP)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ArticleReportBar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders VIN, Mileage, and ZIP input fields', () => {
      setupMocks()
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      expect(screen.getByPlaceholderText(/1HGCM82633A123456/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/42,000/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/90210/i)).toBeInTheDocument()
    })

    it('renders the CTA button', () => {
      setupMocks()
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      expect(
        screen.getByRole('button', { name: /get my independent valuation/i })
      ).toBeInTheDocument()
    })

    it('renders the first value prop initially', () => {
      setupMocks()
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      expect(screen.getByText(/10 Real Comps/i)).toBeInTheDocument()
    })
  })

  describe('value prop ticker', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })
    afterEach(() => {
      jest.useRealTimers()
    })

    it('advances to the second value prop after 3.5 seconds', () => {
      setupMocks()
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      act(() => {
        jest.advanceTimersByTime(3500)
      })
      expect(screen.getByText(/save hours/i)).toBeInTheDocument()
    })

    it('wraps back to the first value prop after all 5 have shown', () => {
      setupMocks()
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      act(() => {
        jest.advanceTimersByTime(3500 * 5)
      })
      expect(screen.getByText(/10 Real Comps/i)).toBeInTheDocument()
    })
  })

  describe('unauthenticated submission', () => {
    it('shows the auth modal when unauthenticated user submits a valid form', async () => {
      setupMocks({ loggedIn: false })
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      await fillForm()
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))
      expect(screen.getByTestId('auth-modal')).toBeInTheDocument()
    })

    it('does not call the report API when unauthenticated', async () => {
      setupMocks({ loggedIn: false })
      global.fetch = jest.fn()
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      await fillForm()
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('authenticated submission', () => {
    it('calls the report creation API with VIN, mileage, and ZIP', async () => {
      setupMocks({ loggedIn: true })
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ report: { id: 'report-123' } }),
      })
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      await fillForm()
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/reports/create',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining(VALID_VIN),
          })
        )
      })
    })

    it('redirects to /pricing with reportId after successful API call', async () => {
      setupMocks({ loggedIn: true })
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ report: { id: 'report-123' } }),
      })
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      await fillForm()
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/pricing?reportId=report-123')
      })
    })

    it('fires kb_article_report_bar_clicked with slug and placement before the API call', async () => {
      setupMocks({ loggedIn: true })
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ report: { id: 'r1' } }),
      })
      render(<ArticleReportBar articleSlug="my-article" placement="post_faq_2" />)
      await fillForm()
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      expect(mockPosthog.capture).toHaveBeenCalledWith(
        'kb_article_report_bar_clicked',
        expect.objectContaining({
          article_slug: 'my-article',
          placement: 'post_faq_2',
        })
      )
    })

    it('shows an error message when the API returns an error', async () => {
      setupMocks({ loggedIn: true })
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Failed to create report' }),
      })
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      await fillForm()
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))
      await waitFor(() => {
        expect(screen.getByText(/failed to create report/i)).toBeInTheDocument()
      })
    })
  })

  describe('form validation', () => {
    it('does not submit when VIN is fewer than 17 characters', async () => {
      setupMocks({ loggedIn: true })
      global.fetch = jest.fn()
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      await userEvent.type(screen.getByPlaceholderText(/1HGCM82633A123456/i), 'SHORT')
      await userEvent.type(screen.getByPlaceholderText(/42,000/i), VALID_MILEAGE)
      await userEvent.type(screen.getByPlaceholderText(/90210/i), VALID_ZIP)
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })
})
