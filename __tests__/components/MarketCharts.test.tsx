import { render, screen } from '@testing-library/react'
import { MarketCharts } from '@/components/MarketCharts'

jest.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  ScatterChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scatter-chart">{children}</div>
  ),
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Bar: () => null,
  Scatter: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Cell: () => null,
  ReferenceLine: () => null,
  Label: () => null,
}))

jest.mock('@/lib/utils/chart-data', () => ({
  createPriceDistribution: jest.fn(() => []),
  findClosestBin: jest.fn(() => ''),
  getBinColor: jest.fn(() => '#10b981'),
  getScatterColor: jest.fn(() => '#3b82f6'),
  getMileageExtent: jest.fn(() => [0, 100000]),
  getPriceExtent: jest.fn(() => [0, 50000]),
}))

const baseProps = {
  listings: [
    { price: 20000, miles: 30000, year: 2020, make: 'Honda', model: 'Civic' },
    { price: 22000, miles: 25000, year: 2020, make: 'Honda', model: 'Civic' },
  ],
  estimatedValue: 21000,
  lowRange: 19000,
  highRange: 23000,
  subjectVehicle: { mileage: 32000, year: 2020, make: 'Honda', model: 'Civic' },
}

describe('MarketCharts', () => {
  it('renders price distribution and mileage section headings', () => {
    render(<MarketCharts {...baseProps} />)
    expect(screen.getByText('Price Distribution')).toBeInTheDocument()
    expect(screen.getByText('Price vs. Mileage Analysis')).toBeInTheDocument()
  })

  it('uses ResponsiveContainer when printMode is not set', () => {
    render(<MarketCharts {...baseProps} />)
    expect(screen.getAllByTestId('responsive-container').length).toBeGreaterThan(0)
  })

  it('does not use ResponsiveContainer in printMode', () => {
    render(<MarketCharts {...baseProps} printMode />)
    expect(screen.queryAllByTestId('responsive-container')).toHaveLength(0)
  })

  it('renders fixed-size chart containers in printMode', () => {
    const { container } = render(<MarketCharts {...baseProps} printMode />)
    const printContainers = container.querySelectorAll('[data-print-chart]')
    expect(printContainers.length).toBe(2)
  })
})
