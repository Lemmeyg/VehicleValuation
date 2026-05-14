/* eslint-disable @next/next/no-html-link-for-pages */
import { render, screen, fireEvent } from '@testing-library/react'
import ExitIntentPopup from '@/components/ExitIntentPopup'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}))

jest.mock('@/lib/analytics/events', () => ({
  trackEvent: jest.fn(),
}))

const pushStateSpy = jest.spyOn(window.history, 'pushState').mockImplementation(() => {})

afterEach(() => {
  sessionStorage.clear()
  pushStateSpy.mockClear()
})

describe('ExitIntentPopup — initial state', () => {
  it('renders nothing by default', () => {
    render(<ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})

describe('ExitIntentPopup — link click trigger', () => {
  it('shows the popup when a link is clicked', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        {}
        <a href="/knowledge-base">KB</a>
      </>
    )
    fireEvent.click(screen.getByText('KB'))
    expect(
      screen.getByText(/your insurance company doesn't want you to have this/i)
    ).toBeInTheDocument()
  })

  it('does not show popup for buy CTA anchors', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <div data-buy-cta>
          <a href="/buy">Buy Now</a>
        </div>
      </>
    )
    fireEvent.click(screen.getByText('Buy Now'))
    expect(screen.queryByText(/insurance company/i)).not.toBeInTheDocument()
  })

  it('does not show popup for hash-only links', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="#faq">FAQ</a>
      </>
    )
    fireEvent.click(screen.getByText('FAQ'))
    expect(screen.queryByText(/insurance company/i)).not.toBeInTheDocument()
  })

  it('does not show popup a second time in the same session', () => {
    sessionStorage.setItem('exit_popup_shown', 'true')
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    expect(screen.queryByText(/insurance company/i)).not.toBeInTheDocument()
  })
})

describe('ExitIntentPopup — copy', () => {
  it('shows the correct headline', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    expect(
      screen.getByText(/before you go — your insurance company doesn't want you to have this/i)
    ).toBeInTheDocument()
  })

  it('shows the correct subtext', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    expect(screen.getByText(/average settlement gap is \$2,800/i)).toBeInTheDocument()
  })

  it('shows the correct CTA button text', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    expect(screen.getByRole('button', { name: /get my report — \$19/i })).toBeInTheDocument()
  })
})

describe('ExitIntentPopup — CTA action', () => {
  it('calls onSelectPlan with the discount code when CTA is clicked', () => {
    const mockSelectPlan = jest.fn()
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={mockSelectPlan} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    fireEvent.click(screen.getByRole('button', { name: /get my report/i }))
    expect(mockSelectPlan).toHaveBeenCalledWith('STAY19')
  })
})

describe('ExitIntentPopup — back button trigger', () => {
  it('shows the popup when popstate fires', () => {
    render(<ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />)
    fireEvent(window, new PopStateEvent('popstate'))
    expect(screen.queryByText(/insurance company/i)).toBeInTheDocument()
  })
})
