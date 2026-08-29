/** @jest-environment node */
import { splitModelAndBodyType } from '@/lib/utils/vehicle-model'

describe('splitModelAndBodyType', () => {
  it.each([
    ['Civic Coupe', { model: 'Civic', bodyType: 'Coupe' }],
    ['Civic Sedan', { model: 'Civic', bodyType: 'Sedan' }],
    ['Focus Hatchback', { model: 'Focus', bodyType: 'Hatchback' }],
    ['3 Series Convertible', { model: '3 Series', bodyType: 'Convertible' }],
    ['F-150 Crew Cab', { model: 'F-150', bodyType: 'Pickup' }],
  ])('%s -> %o', (input, expected) => {
    expect(splitModelAndBodyType(input as string)).toEqual(expected)
  })

  it('leaves a canonical model alone (no bodyType)', () => {
    for (const m of [
      'F-150',
      'Grand Highlander',
      'Santa Fe Sport',
      'Wrangler Unlimited',
      'Model S',
      'Prius c',
      'IONIQ 5',
    ]) {
      expect(splitModelAndBodyType(m)).toEqual({ model: m })
    }
  })

  it('does not strip a model that IS a body-style word', () => {
    expect(splitModelAndBodyType('Coupe')).toEqual({ model: 'Coupe' })
  })

  it('trims surrounding whitespace and still splits', () => {
    expect(splitModelAndBodyType('  Civic Coupe  ')).toEqual({ model: 'Civic', bodyType: 'Coupe' })
  })

  it('is case-insensitive on the trailing token', () => {
    expect(splitModelAndBodyType('Civic COUPE')).toEqual({ model: 'Civic', bodyType: 'Coupe' })
  })

  it('handles empty / whitespace-only input without throwing', () => {
    expect(splitModelAndBodyType('')).toEqual({ model: '' })
    expect(splitModelAndBodyType('   ')).toEqual({ model: '' })
  })

  it('leaves an unmapped trailing token (wagon) on the model string', () => {
    expect(splitModelAndBodyType('Outback Wagon')).toEqual({ model: 'Outback Wagon' })
  })
})
