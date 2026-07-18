import { render, screen } from '@testing-library/react'
import { VehicleReportPDF } from '@/lib/pdf/report-template'

const baseData = {
  id: 'report-1',
  vin: '1HGBH41JXMN109186',
  mileage: 30000,
  createdAt: '2026-07-01T12:00:00Z',
}

describe('VehicleReportPDF — money-back guarantee box', () => {
  it('does NOT render the guarantee box for a BASIC report', () => {
    render(<VehicleReportPDF data={{ ...baseData, reportType: 'BASIC' }} />)
    expect(screen.queryByText(/100% Money-Back Guarantee/i)).not.toBeInTheDocument()
  })

  it('renders the guarantee box for a PREMIUM report', () => {
    render(<VehicleReportPDF data={{ ...baseData, reportType: 'PREMIUM' }} />)
    expect(screen.getByText(/100% Money-Back Guarantee/i)).toBeInTheDocument()
  })
})
