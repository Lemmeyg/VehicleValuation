describe('PDF filename generation', () => {
  it('formats VIN into filename correctly', () => {
    const vin = '1HGBH41JXMN109186'
    const sanitizedVin = vin.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const filename = `total-loss-report-${sanitizedVin}.pdf`
    expect(filename).toBe('total-loss-report-1HGBH41JXMN109186.pdf')
  })

  it('strips spaces and special characters from VIN in filename', () => {
    const vin = '1HGB H41JX MN109186'
    const sanitizedVin = vin.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const filename = `total-loss-report-${sanitizedVin}.pdf`
    expect(filename).toBe('total-loss-report-1HGBH41JXMN109186.pdf')
  })

  it('handles lowercase VIN', () => {
    const vin = '1hgbh41jxmn109186'
    const sanitizedVin = vin.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const filename = `total-loss-report-${sanitizedVin}.pdf`
    expect(filename).toBe('total-loss-report-1HGBH41JXMN109186.pdf')
  })
})
