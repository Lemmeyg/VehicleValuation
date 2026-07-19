export interface PersonalizationVehicleData {
  year: number
  make: string
  model: string
}

export function getPersonalizedVehicleLabel(
  vehicleData: PersonalizationVehicleData | null | undefined
): string | null {
  if (!vehicleData) return null

  const make = vehicleData.make?.trim()
  const model = vehicleData.model?.trim()

  if (!vehicleData.year || !make || !model) return null

  return `${vehicleData.year} ${make} ${model}`
}
