export function splitStationName(nomStation: string): { name: string; location: string | null } {
  const separator = nomStation.indexOf(' - ')
  const place = separator === -1 ? nomStation.trim() : nomStation.slice(separator + 3).trim()

  const commaIdx = place.lastIndexOf(', ')
  if (commaIdx === -1) {
    return { name: place, location: null }
  }

  return {
    name: place.slice(commaIdx + 2).trim(),
    location: place.slice(0, commaIdx).trim(),
  }
}

export function isFreeAccess(conditionAcces: string): boolean {
  return conditionAcces.trim().toLowerCase() === 'accès libre'
}

export type AvailabilityTone = 'none' | 'available'

export function getAvailabilityTone(availableCount: number): AvailabilityTone {
  return availableCount === 0 ? 'none' : 'available'
}
