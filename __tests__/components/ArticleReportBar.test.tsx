/**
 * Tests for ArticleReportBar component
 *
 * Covers: render, value-prop ticker, form validation, localStorage storage,
 * redirect to pricing, and PostHog analytics events.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { ArticleReportBar } from '@/components/ArticleReportBar'

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('posthog-js', () => ({ __loaded: true, capture: jest.fn() }))

const mockPush = jest.fn()
const mockPosthog = posthog as jest.Mocked<typeof posthog>

function setupMocks() {
  ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
}

const VALID_VIN = '1HGBH41JXMN109186'
const VALID_MILEAGE = '42000'
const VALID_ZIP = '90210'
const VALID_EMAIL = 'test@example.com'

async function fillForm({ email = VALID_EMAIL }: { email?: string } = {}) {
  await userEvent.type(screen.getByPlaceholderText(/1HGCM82633A123456/i), VALID_VIN)
  await userEvent.type(screen.getByPlaceholderText(/42,000/i), VALID_MILEAGE)
  await userEvent.type(screen.getByPlaceholderText(/90210/i), VALID_ZIP)
  if (email) {
    await userEvent.type(screen.getByLabelText(/^email$/i), email)
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ArticleReportBar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupMocks()
    localStorage.clear()
  })

  describe('rendering', () => {
    it('renders VIN, Mileage, and ZIP input fields', () => {
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      expect(screen.getByPlaceholderText(/1HGCM82633A123456/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/42,000/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/90210/i)).toBeInTheDocument()
    })

    it('renders the CTA button', () => {
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      expect(
        screen.getByRole('button', { name: /get my independent valuation/i })
      ).toBeInTheDocument()
    })

    it('renders the first value prop initially', () => {
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
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      act(() => {
        jest.advanceTimersByTime(3500)
      })
      expect(screen.getByText(/save hours/i)).toBeInTheDocument()
    })

    it('wraps back to the first value prop after all 5 have shown', () => {
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      act(() => {
        jest.advanceTimersByTime(3500 * 5)
      })
      expect(screen.getByText(/10 Real Comps/i)).toBeInTheDocument()
    })
  })

  describe('form submission', () => {
    it('stores form data in localStorage and redirects to /pricing', async () => {
      global.fetch = jest.fn()
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      await fillForm()
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/pricing')
      })
      const stored = JSON.parse(localStorage.getItem('hero_form_data') || '{}')
      expect(stored.vin).toBe(VALID_VIN)
      expect(stored.mileage).toBe(parseInt(VALID_MILEAGE))
      expect(stored.zipCode).toBe(VALID_ZIP)
      expect(stored.email).toBe(VALID_EMAIL)
    })

    it('calls /api/leads/capture with the sanitized email on submission', async () => {
      global.fetch = jest.fn()
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      await fillForm({ email: '  Test@Example.com  ' })
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))
      await waitFor(() => expect(mockPush).toHaveBeenCalled())
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/leads/capture',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com', source: 'KB report form' }),
        })
      )
    })

    it('does not show any auth modal', async () => {
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      await fillForm()
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))
      await waitFor(() => expect(mockPush).toHaveBeenCalled())
      expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument()
    })
  })

  describe('form validation', () => {
    it('does not submit when VIN is fewer than 17 characters', async () => {
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      await userEvent.type(screen.getByPlaceholderText(/1HGCM82633A123456/i), 'SHORT')
      await userEvent.type(screen.getByPlaceholderText(/42,000/i), VALID_MILEAGE)
      await userEvent.type(screen.getByPlaceholderText(/90210/i), VALID_ZIP)
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))
      expect(mockPush).not.toHaveBeenCalled()
      expect(localStorage.getItem('hero_form_data')).toBeNull()
    })

    it('renders the email field', () => {
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    })

    it('disables submit when email is empty', async () => {
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      await fillForm({ email: '' })
      expect(screen.getByRole('button', { name: /get my independent valuation/i })).toBeDisabled()
    })

    it('disables submit when email is invalid', async () => {
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      await fillForm({ email: 'not-an-email' })
      expect(screen.getByRole('button', { name: /get my independent valuation/i })).toBeDisabled()
    })

    it('shows a validation warning and does not submit when submitted without a valid email', async () => {
      render(<ArticleReportBar articleSlug="test-article" placement="post_toc" />)
      await fillForm({ email: '' })
      fireEvent.submit(screen.getByLabelText(/^email$/i).closest('form')!)

      expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
      expect(mockPush).not.toHaveBeenCalled()
      expect(localStorage.getItem('hero_form_data')).toBeNull()
    })
  })

  describe('analytics tracking', () => {
    it('fires article_bar_form_started on first field interaction', async () => {
      render(<ArticleReportBar articleSlug="test-slug" placement="post_toc" />)
      await userEvent.type(screen.getByPlaceholderText(/1HGCM82633A123456/i), 'A')
      expect(mockPosthog.capture).toHaveBeenCalledWith(
        'report_workflow',
        expect.objectContaining({
          step: 'article_bar_form_started',
          kb_source_slug: 'test-slug',
        })
      )
    })

    it('fires article_bar_form_started only once even across multiple field changes', async () => {
      render(<ArticleReportBar articleSlug="test-slug" placement="post_toc" />)
      await userEvent.type(screen.getByPlaceholderText(/1HGCM82633A123456/i), 'A')
      await userEvent.type(screen.getByPlaceholderText(/42,000/i), '1')
      const formStartedCalls = mockPosthog.capture.mock.calls.filter(
        ([name, props]: [string, Record<string, unknown>]) =>
          name === 'report_workflow' && props?.step === 'article_bar_form_started'
      )
      expect(formStartedCalls).toHaveLength(1)
    })

    it('fires kb_article_report_bar_clicked with slug and placement on submit', async () => {
      render(<ArticleReportBar articleSlug="my-article" placement="post_faq_2" />)
      await fillForm()
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))
      await waitFor(() => expect(mockPush).toHaveBeenCalled())
      expect(mockPosthog.capture).toHaveBeenCalledWith(
        'kb_article_report_bar_clicked',
        expect.objectContaining({
          article_slug: 'my-article',
          placement: 'post_faq_2',
        })
      )
    })

    it('fires form_submitted with success:true on submit', async () => {
      render(<ArticleReportBar articleSlug="test-slug" placement="post_toc" />)
      await fillForm()
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))
      await waitFor(() => expect(mockPush).toHaveBeenCalled())
      expect(mockPosthog.capture).toHaveBeenCalledWith(
        'form_submitted',
        expect.objectContaining({ form: 'article_report_bar', success: true })
      )
    })

    it('fires report_workflow article_bar_form_submitted on submit', async () => {
      render(<ArticleReportBar articleSlug="my-article" placement="post_toc" />)
      await fillForm()
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))
      await waitFor(() => expect(mockPush).toHaveBeenCalled())
      expect(mockPosthog.capture).toHaveBeenCalledWith(
        'report_workflow',
        expect.objectContaining({
          step: 'article_bar_form_submitted',
          kb_source_slug: 'my-article',
        })
      )
    })
  })
})
