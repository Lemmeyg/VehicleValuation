import { render, screen, fireEvent } from '@testing-library/react'
import { KBFilterBar } from '@/components/KBFilterBar'

const categories = ['Insurance Claims', 'Vehicle Valuation', 'State Guides']

describe('KBFilterBar', () => {
  it('renders the search input', () => {
    render(
      <KBFilterBar categories={categories} onSearch={jest.fn()} onCategoryChange={jest.fn()} />
    )
    expect(screen.getByPlaceholderText('Search articles…')).toBeInTheDocument()
  })

  it('renders the Search submit button', () => {
    render(
      <KBFilterBar categories={categories} onSearch={jest.fn()} onCategoryChange={jest.fn()} />
    )
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })

  it('renders an "All" button', () => {
    render(
      <KBFilterBar categories={categories} onSearch={jest.fn()} onCategoryChange={jest.fn()} />
    )
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
  })

  it('renders a button for each category', () => {
    render(
      <KBFilterBar categories={categories} onSearch={jest.fn()} onCategoryChange={jest.fn()} />
    )
    expect(screen.getByRole('button', { name: 'Insurance Claims' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vehicle Valuation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'State Guides' })).toBeInTheDocument()
  })

  it('applies active style to "All" when no activeCategory is set', () => {
    render(
      <KBFilterBar categories={categories} onSearch={jest.fn()} onCategoryChange={jest.fn()} />
    )
    expect(screen.getByRole('button', { name: 'All' }).className).toContain('bg-primary-600')
  })

  it('applies active style to the matching category button', () => {
    render(
      <KBFilterBar
        categories={categories}
        activeCategory="Insurance Claims"
        onSearch={jest.fn()}
        onCategoryChange={jest.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Insurance Claims' }).className).toContain(
      'bg-primary-600'
    )
  })

  it('calls onCategoryChange with the category name when a category button is clicked', () => {
    const onCategoryChange = jest.fn()
    render(
      <KBFilterBar
        categories={categories}
        onSearch={jest.fn()}
        onCategoryChange={onCategoryChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Insurance Claims' }))
    expect(onCategoryChange).toHaveBeenCalledWith('Insurance Claims')
  })

  it('calls onCategoryChange with null when "All" is clicked', () => {
    const onCategoryChange = jest.fn()
    render(
      <KBFilterBar
        categories={categories}
        activeCategory="Insurance Claims"
        onSearch={jest.fn()}
        onCategoryChange={onCategoryChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(onCategoryChange).toHaveBeenCalledWith(null)
  })

  it('calls onCategoryChange with null when the active category is clicked again (toggle off)', () => {
    const onCategoryChange = jest.fn()
    render(
      <KBFilterBar
        categories={categories}
        activeCategory="Insurance Claims"
        onSearch={jest.fn()}
        onCategoryChange={onCategoryChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Insurance Claims' }))
    expect(onCategoryChange).toHaveBeenCalledWith(null)
  })

  it('calls onSearch with the input value when the form is submitted', () => {
    const onSearch = jest.fn()
    render(<KBFilterBar categories={categories} onSearch={onSearch} onCategoryChange={jest.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Search articles…'), {
      target: { value: 'total loss' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }).closest('form')!)
    expect(onSearch).toHaveBeenCalledWith('total loss')
  })

  it('shows the current activeQuery in the input', () => {
    render(
      <KBFilterBar
        categories={categories}
        activeQuery="settlement"
        onSearch={jest.fn()}
        onCategoryChange={jest.fn()}
      />
    )
    expect((screen.getByPlaceholderText('Search articles…') as HTMLInputElement).value).toBe(
      'settlement'
    )
  })

  it('clears the search input when activeQuery prop changes to undefined', () => {
    const { rerender } = render(
      <KBFilterBar
        categories={categories}
        activeQuery="dispute"
        onSearch={jest.fn()}
        onCategoryChange={jest.fn()}
      />
    )
    expect((screen.getByPlaceholderText('Search articles…') as HTMLInputElement).value).toBe(
      'dispute'
    )

    rerender(
      <KBFilterBar
        categories={categories}
        activeQuery={undefined}
        onSearch={jest.fn()}
        onCategoryChange={jest.fn()}
      />
    )
    expect((screen.getByPlaceholderText('Search articles…') as HTMLInputElement).value).toBe('')
  })
})
