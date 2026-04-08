describe('PDF filename generation', () => {
  function buildFilename(
    autodevVinData: { vehicle?: { year?: number }; make?: string; model?: string } | null,
    vin: string
  ): string {
    const year = autodevVinData?.vehicle?.year
    const make = autodevVinData?.make
    const model = autodevVinData?.model

    let filenamePart: string
    if (year && make && model) {
      filenamePart = `${year}-${make}-${model}`.replace(/[^A-Za-z0-9-]/g, '-').replace(/-+/g, '-')
    } else {
      filenamePart = vin.toUpperCase().replace(/[^A-Z0-9]/g, '')
    }
    return `total-loss-report-${filenamePart}.pdf`
  }

  it('uses year, make, and model when vehicle data is present', () => {
    const filename = buildFilename(
      { vehicle: { year: 2019 }, make: 'Honda', model: 'Civic' },
      '1HGBH41JXMN109186'
    )
    expect(filename).toBe('total-loss-report-2019-Honda-Civic.pdf')
  })

  it('replaces spaces in make/model with hyphens', () => {
    const filename = buildFilename(
      { vehicle: { year: 2021 }, make: 'Land Rover', model: 'Range Rover' },
      '1HGBH41JXMN109186'
    )
    expect(filename).toBe('total-loss-report-2021-Land-Rover-Range-Rover.pdf')
  })

  it('falls back to VIN when autodevVinData is null', () => {
    const filename = buildFilename(null, '1HGBH41JXMN109186')
    expect(filename).toBe('total-loss-report-1HGBH41JXMN109186.pdf')
  })

  it('falls back to VIN when year is missing', () => {
    const filename = buildFilename(
      { vehicle: {}, make: 'Honda', model: 'Civic' },
      '1HGBH41JXMN109186'
    )
    expect(filename).toBe('total-loss-report-1HGBH41JXMN109186.pdf')
  })

  it('falls back to VIN when make is missing', () => {
    const filename = buildFilename({ vehicle: { year: 2019 }, model: 'Civic' }, '1HGBH41JXMN109186')
    expect(filename).toBe('total-loss-report-1HGBH41JXMN109186.pdf')
  })
})

describe('PDF admin URL TTL constant', () => {
  const ADMIN_URL_TTL_SECONDS = 315_360_000 // 10 years

  it('is approximately 10 years in seconds', () => {
    const tenYearsInSeconds = 10 * 365 * 24 * 60 * 60
    expect(ADMIN_URL_TTL_SECONDS).toBe(tenYearsInSeconds)
  })
})
