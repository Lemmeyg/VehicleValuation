import { render, screen, act } from '@testing-library/react'
import { Reveal } from '@/components/ui/Reveal'

describe('Reveal', () => {
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

  it('always renders its children, even before being revealed', () => {
    render(
      <Reveal>
        <p>Testimonial content</p>
      </Reveal>
    )
    expect(screen.getByText('Testimonial content')).toBeInTheDocument()
  })

  it('starts with opacity-0 and switches to opacity-100 once scrolled into view', () => {
    render(
      <Reveal>
        <p>Testimonial content</p>
      </Reveal>
    )
    const wrapper = screen.getByText('Testimonial content').parentElement as HTMLElement
    expect(wrapper.className).toContain('opacity-0')

    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })
    expect(wrapper.className).toContain('opacity-100')
  })

  it('applies the requested transition delay', () => {
    render(
      <Reveal delayMs={160}>
        <p>Testimonial content</p>
      </Reveal>
    )
    const wrapper = screen.getByText('Testimonial content').parentElement as HTMLElement
    expect(wrapper.style.transitionDelay).toBe('160ms')
  })

  it('renders already-revealed when the visitor prefers reduced motion', () => {
    matchMediaMock.mockReturnValue({ matches: true })
    render(
      <Reveal>
        <p>Testimonial content</p>
      </Reveal>
    )
    const wrapper = screen.getByText('Testimonial content').parentElement as HTMLElement
    expect(wrapper.className).toContain('opacity-100')
  })
})
