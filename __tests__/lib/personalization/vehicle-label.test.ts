import { getPersonalizedVehicleLabel } from '@/lib/personalization/vehicle-label'

describe('getPersonalizedVehicleLabel', () => {
  it('formats year, make, and model into a single label', () => {
    expect(getPersonalizedVehicleLabel({ year: 2019, make: 'Honda', model: 'Civic' })).toBe(
      '2019 Honda Civic'
    )
  })

  it('returns null when vehicleData is null', () => {
    expect(getPersonalizedVehicleLabel(null)).toBeNull()
  })

  it('returns null when vehicleData is undefined', () => {
    expect(getPersonalizedVehicleLabel(undefined)).toBeNull()
  })

  it('returns null when year is 0 (failed VIN decode)', () => {
    expect(getPersonalizedVehicleLabel({ year: 0, make: '', model: '' })).toBeNull()
  })

  it('returns null when make is empty', () => {
    expect(getPersonalizedVehicleLabel({ year: 2019, make: '', model: 'Civic' })).toBeNull()
  })

  it('returns null when model is empty', () => {
    expect(getPersonalizedVehicleLabel({ year: 2019, make: 'Honda', model: '' })).toBeNull()
  })

  it('trims whitespace-only make/model as missing', () => {
    expect(getPersonalizedVehicleLabel({ year: 2019, make: '  ', model: 'Civic' })).toBeNull()
  })
})
