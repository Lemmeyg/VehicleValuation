import { render, screen } from '@testing-library/react'
import CompsCheckPage, { metadata } from '@/app/comps-check/page'

// Mock Next.js navigation (used by Navbar)
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/comps-check',
}))

jest.mock('@/components/CompsCheckForm', () => {
  return function MockCompsCheckForm(props: { pageVariant?: string; submitLabel?: string }) {
    return (
      <div
        data-testid="comps-check-form"
        data-page-variant={props.pageVariant}
        data-submit-label={props.submitLabel}
      />
    )
  }
})

const mockGetCopy = jest.fn()
jest.mock('@/lib/audit-submissions/page-copy', () => ({
  getCompsCheckCopy: () => mockGetCopy(),
}))

const DEFAULT_COPY = {
  version: 'default',
  headline: "Let us double-check your insurer's numbers",
  subheadline: 'Upload the comps list or valuation report your insurance company sent you.',
  submitLabel: 'Submit for review',
  trustLine: null,
}

beforeEach(() => {
  mockGetCopy.mockResolvedValue(DEFAULT_COPY)
})

jest.mock('@/components/Navbar', () => {
  return function MockNavbar() {
    return <div data-testid="navbar" />
  }
})

jest.mock('@/components/Footer', () => {
  return function MockFooter() {
    return <div data-testid="footer" />
  }
})

describe('/comps-check metadata', () => {
  it('sets robots to noindex, nofollow', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
})

describe('CompsCheckPage', () => {
  it('renders the beta label, heading, and the form', async () => {
    render(await CompsCheckPage())
    expect(screen.getByText(/beta/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(DEFAULT_COPY.headline)
    expect(screen.getByTestId('comps-check-form')).toBeInTheDocument()
  })

  it('renders the copy-slot wording and passes its version and button label to the form', async () => {
    mockGetCopy.mockResolvedValue({
      version: 'v2',
      headline: 'Did your insurer lowball your car?',
      subheadline: 'Send us their valuation report and a person will check it for free.',
      submitLabel: 'Check my report',
      trustLine: 'Free. Read by a person. Deleted within 90 days.',
    })
    render(await CompsCheckPage())
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Did your insurer lowball your car?'
    )
    expect(screen.getByText(/read by a person/i)).toBeInTheDocument()
    const form = screen.getByTestId('comps-check-form')
    expect(form).toHaveAttribute('data-page-variant', 'v2')
    expect(form).toHaveAttribute('data-submit-label', 'Check my report')
  })

  it('explains what happens next in three steps', async () => {
    render(await CompsCheckPage())
    const steps = screen.getByRole('list', { name: /how it works/i })
    expect(steps.querySelectorAll('li')).toHaveLength(3)
    expect(steps).toHaveTextContent(/within 48 hours/i)
  })

  it('does not render an empty trust line', async () => {
    const { container } = render(await CompsCheckPage())
    expect(container.querySelectorAll('p.font-medium')).toHaveLength(0)
  })
})
