import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ContactUsDialog from '@/components/directory/ContactUsDialog'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

beforeEach(() => {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({}),
  })
})

describe('ContactUsDialog — unauthenticated', () => {
  it('opens the dialog without redirecting', async () => {
    render(<ContactUsDialog isAuthenticated={false} userName="" userEmail="" />)
    fireEvent.click(screen.getByText('contact us'))
    expect(screen.getByRole('heading', { name: 'Request a Service' })).toBeInTheDocument()
  })

  it('shows empty name and email fields', () => {
    render(<ContactUsDialog isAuthenticated={false} userName="" userEmail="" />)
    fireEvent.click(screen.getByText('contact us'))
    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByLabelText('Email')).toHaveValue('')
  })

  it('allows typing into name and email fields', () => {
    render(<ContactUsDialog isAuthenticated={false} userName="" userEmail="" />)
    fireEvent.click(screen.getByText('contact us'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } })
    expect(screen.getByLabelText('Name')).toHaveValue('Jane Doe')
    expect(screen.getByLabelText('Email')).toHaveValue('jane@example.com')
  })
})

describe('ContactUsDialog — authenticated', () => {
  it('pre-populates name and email from props', () => {
    render(
      <ContactUsDialog isAuthenticated={true} userName="Jane Doe" userEmail="jane@example.com" />
    )
    fireEvent.click(screen.getByText('contact us'))
    expect(screen.getByLabelText('Name')).toHaveValue('Jane Doe')
    expect(screen.getByLabelText('Email')).toHaveValue('jane@example.com')
  })

  it('allows editing pre-populated fields', () => {
    render(
      <ContactUsDialog isAuthenticated={true} userName="Jane Doe" userEmail="jane@example.com" />
    )
    fireEvent.click(screen.getByText('contact us'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John Doe' } })
    expect(screen.getByLabelText('Name')).toHaveValue('John Doe')
  })
})

describe('ContactUsDialog — submission', () => {
  it('sends name and email typed by user in the request body', async () => {
    render(<ContactUsDialog isAuthenticated={false} userName="" userEmail="" />)
    fireEvent.click(screen.getByText('contact us'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByRole('textbox', { name: /what service do you need/i }), {
      target: { value: 'Need a public adjuster' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/suppliers/service-request',
        expect.objectContaining({
          body: JSON.stringify({
            contactName: 'Test User',
            contactEmail: 'test@example.com',
            message: 'Need a public adjuster',
            serviceNeeded: 'Service Required',
          }),
        })
      )
    })
  })
})
