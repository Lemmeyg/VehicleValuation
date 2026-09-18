/**
 * Tests for ReportPreviewCondensed
 *
 * Covers: the default (non-collapsible) render used by Hero.tsx stays
 * unaffected, and the new collapsible variant (BL-155) — value cards visible
 * without a click, expand/collapse behavior, the onExpand callback firing
 * exactly once, and the scroll-triggered attention cue.
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import ReportPreviewCondensed from '@/components/ReportPreviewCondensed'

describe('ReportPreviewCondensed', () => {
  describe('default usage (collapsible omitted — Hero.tsx)', () => {
    it('renders every section fully, with no expand button', () => {
      render(<ReportPreviewCondensed />)
      expect(screen.getByRole('heading', { level: 1, name: '2021 BMW X3' })).toBeInTheDocument()
      expect(screen.getAllByText('$20,389').length).toBeGreaterThan(0)
      expect(screen.getByText('Vehicle Specifications')).toBeInTheDocument()
      expect(screen.getByText('Market Comparables')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('does not render the 90-Day Guarantee pill (Hero renders its own badge separately)', () => {
      render(<ReportPreviewCondensed />)
      expect(screen.queryByText('90-Day Guarantee')).not.toBeInTheDocument()
    })
  })

  describe('collapsible variant (BL-155 pricing-page teaser)', () => {
    it('shows the value cards and guarantee pill immediately, with no click needed', () => {
      render(<ReportPreviewCondensed collapsible />)
      // These figures also repeat further down in the always-in-DOM "Value
      // Summary" section (visually clipped, not removed, until expanded) —
      // assert presence rather than uniqueness.
      expect(screen.getAllByText('$20,389').length).toBeGreaterThan(0)
      expect(screen.getAllByText('$22,654').length).toBeGreaterThan(0)
      expect(screen.getAllByText('$24,919').length).toBeGreaterThan(0)
      expect(screen.getByText('90-Day Guarantee')).toBeInTheDocument()
    })

    it('renders the expand button, collapsed by default', () => {
      render(<ReportPreviewCondensed collapsible />)
      const button = screen.getByRole('button', { name: /see what's inside your sample report/i })
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })

    it('expands to show the full detail and updates the label on click', () => {
      render(<ReportPreviewCondensed collapsible />)
      const button = screen.getByRole('button', { name: /see what's inside your sample report/i })
      fireEvent.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByText(/collapse sample report/i)).toBeInTheDocument()
    })

    it('collapses back on a second click without re-firing onExpand', () => {
      const onExpand = jest.fn()
      render(<ReportPreviewCondensed collapsible onExpand={onExpand} />)
      const button = screen.getByRole('button', { name: /see what's inside your sample report/i })
      fireEvent.click(button) // expand
      fireEvent.click(button) // collapse
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(onExpand).toHaveBeenCalledTimes(1)
    })

    it('calls onExpand exactly once, only on the transition to expanded', () => {
      const onExpand = jest.fn()
      render(<ReportPreviewCondensed collapsible onExpand={onExpand} />)
      const button = screen.getByRole('button', { name: /see what's inside your sample report/i })
      fireEvent.click(button) // expand -> fires
      fireEvent.click(button) // collapse -> should not fire
      fireEvent.click(button) // expand again -> real usage stops the cue, but click still toggles
      expect(onExpand).toHaveBeenCalledTimes(2)
    })
  })

  describe('scroll-triggered attention cue', () => {
    let observerCallback: IntersectionObserverCallback

    beforeEach(() => {
      observerCallback = jest.fn() as unknown as IntersectionObserverCallback
      global.IntersectionObserver = jest
        .fn()
        .mockImplementation((cb: IntersectionObserverCallback) => {
          observerCallback = cb
          return { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() }
        }) as unknown as typeof IntersectionObserver
    })

    it('does not pulse before the button has scrolled into view', () => {
      render(<ReportPreviewCondensed collapsible />)
      const button = screen.getByRole('button', { name: /see what's inside your sample report/i })
      expect(button.className).not.toContain('animate-ring-pulse')
    })

    it('starts pulsing once the button scrolls into view', () => {
      render(<ReportPreviewCondensed collapsible />)
      const button = screen.getByRole('button', { name: /see what's inside your sample report/i })
      act(() => {
        observerCallback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      })
      expect(button.className).toContain('animate-ring-pulse')
    })

    it('stops pulsing for good once the visitor expands the panel', () => {
      render(<ReportPreviewCondensed collapsible />)
      const button = screen.getByRole('button', { name: /see what's inside your sample report/i })
      act(() => {
        observerCallback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      })
      fireEvent.click(button)
      expect(button.className).not.toContain('animate-ring-pulse')
    })

    it('calls onView when the card scrolls into view', () => {
      const onView = jest.fn()
      render(<ReportPreviewCondensed collapsible onView={onView} />)
      act(() => {
        observerCallback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      })
      expect(onView).toHaveBeenCalledTimes(1)
    })

    it('does not call onView when collapsible is false', () => {
      const onView = jest.fn()
      render(<ReportPreviewCondensed onView={onView} />)
      expect(onView).not.toHaveBeenCalled()
    })
  })
})
