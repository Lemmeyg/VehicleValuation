/* eslint-disable @next/next/no-html-link-for-pages */
import { render, screen, fireEvent } from '@testing-library/react'
import ExitIntentPopup from '@/components/ExitIntentPopup'

const mockPush = jest.fn()
const mockBack = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

jest.mock('@/lib/analytics/events', () => ({
  trackEvent: jest.fn(),
}))

const pushStateSpy = jest.spyOn(window.history, 'pushState').mockImplementation(() => {})

afterEach(() => {
  sessionStorage.clear()
  pushStateSpy.mockClear()
  mockPush.mockClear()
  mockBack.mockClear()
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
    expect(screen.getByRole('button', { name: /get my report — \$15/i })).toBeInTheDocument()
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
    expect(mockSelectPlan).toHaveBeenCalledWith('STAY15')
  })
})

describe('ExitIntentPopup — dismiss behaviour', () => {
  it('does NOT dismiss when the backdrop overlay is clicked', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    // Trigger popup
    fireEvent.click(screen.getByText('Home'))
    expect(screen.getByRole('heading', { name: /insurance company/i })).toBeInTheDocument()

    // Click the backdrop (outside the card)
    fireEvent.click(screen.getByTestId('popup-backdrop'))
    // Popup must still be visible — and no navigation should have fired
    expect(screen.getByRole('heading', { name: /insurance company/i })).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('dismisses when the X button is clicked', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    expect(screen.getByRole('heading', { name: /insurance company/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('heading', { name: /insurance company/i })).not.toBeInTheDocument()
    expect(mockPush).toHaveBeenCalledWith('/home')
  })
})

describe('ExitIntentPopup — back button trigger', () => {
  it('shows the popup when popstate fires', () => {
    render(<ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />)
    fireEvent(window, new PopStateEvent('popstate'))
    expect(screen.queryByRole('heading', { name: /insurance company/i })).toBeInTheDocument()
  })
})

describe('ExitIntentPopup — mouse-leave trigger', () => {
  it('shows the popup when the cursor exits through the top of the viewport', () => {
    render(<ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />)
    fireEvent.mouseOut(document, { clientY: -5, relatedTarget: null })
    expect(screen.queryByRole('heading', { name: /insurance company/i })).toBeInTheDocument()
  })

  it('does not show the popup for an ordinary mouseout within the page', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <div data-testid="inner">inner</div>
      </>
    )
    fireEvent.mouseOut(document, { clientY: 400, relatedTarget: screen.getByTestId('inner') })
    expect(screen.queryByRole('heading', { name: /insurance company/i })).not.toBeInTheDocument()
  })

  it('does not show the popup when leaving the top edge onto another element', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <div data-testid="inner">inner</div>
      </>
    )
    fireEvent.mouseOut(document, { clientY: -5, relatedTarget: screen.getByTestId('inner') })
    expect(screen.queryByRole('heading', { name: /insurance company/i })).not.toBeInTheDocument()
  })
})

describe('ExitIntentPopup — personalized copy', () => {
  it('shows the personalized headline when vehicle data is complete', () => {
    render(
      <>
        <ExitIntentPopup
          vin="1HGCM82633A123456"
          reportId="r1"
          vehicleYear={2019}
          vehicleMake="Honda"
          vehicleModel="Civic"
          onSelectPlan={jest.fn()}
        />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    expect(
      screen.getByText(/before you go — your 2019 Honda Civic may be undervalued/i)
    ).toBeInTheDocument()
  })

  it('falls back to generic headline when vehicle data is incomplete', () => {
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

  it('shows a text dismiss option that triggers the same dismiss behavior', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    fireEvent.click(screen.getByText(/no thanks, i'll take what the insurance company offers/i))
    expect(
      screen.queryByText(/insurance company doesn't want you to have this/i)
    ).not.toBeInTheDocument()
  })
})
