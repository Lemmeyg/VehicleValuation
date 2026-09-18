import { render, screen, act } from '@testing-library/react'
import { CountUp } from '@/components/ui/CountUp'

describe('CountUp', () => {
  let observerCallback: IntersectionObserverCallback
  let matchMediaMock: jest.Mock

  beforeEach(() => {
    observerCallback = jest.fn() as unknown as IntersectionObserverCallback
    global.IntersectionObserver = jest
      .fn()
      .mockImplementation((cb: IntersectionObserverCallback) => {
        observerCallback = cb
        return { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() }
      }) as unknown as typeof IntersectionObserver

    matchMediaMock = jest.fn().mockReturnValue({ matches: false })
    window.matchMedia = matchMediaMock as unknown as typeof window.matchMedia
  })

  it('starts at 0 before scrolling into view', () => {
    render(<CountUp to={34} suffix="%" />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('reaches the target value once scrolled into view', async () => {
    render(<CountUp to={34} suffix="%" durationMs={10} />)
    await act(async () => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
      await new Promise(resolve => setTimeout(resolve, 50))
    })
    expect(screen.getByText('34%')).toBeInTheDocument()
  })

  it('formats with a prefix and comma grouping', () => {
    matchMediaMock.mockReturnValue({ matches: true }) // reduced motion -> immediate final value
    render(<CountUp to={13200} prefix="+$" comma />)
    expect(screen.getByText('+$13,200')).toBeInTheDocument()
  })

  it('shows the final value immediately under reduced motion, with no animation', () => {
    matchMediaMock.mockReturnValue({ matches: true })
    render(<CountUp to={9} suffix="/10" />)
    expect(screen.getByText('9/10')).toBeInTheDocument()
  })
})
