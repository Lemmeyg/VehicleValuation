import zipState from 'zip-state'

export function resolveStateCodeFromZip(zip: string | null | undefined): string | null {
  if (!zip) return null
  return zipState(zip)
}
