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

/** Coordonnées GPS copiables (lat, lng) — compatibles Google Maps, Plans, etc. */
export function formatStationCoordinates(lat: number, lng: number): string {
  return `${lat},${lng}`
}

/** Adresse postale à partir du détail QualiCharge, si disponible. */
export function formatStationAddress(detail: {
  adresse_station: string | null
  nom_station: string
}): string | null {
  const street = detail.adresse_station?.trim()
  if (!street) return null

  const city = detail.nom_station.split(' - ').pop()?.trim()
  if (city && city !== street) {
    return `${street}, ${city}`
  }

  return street
}

/** Texte à copier : adresse postale si connue, sinon coordonnées. */
export function formatStationCopyText(
  lat: number,
  lng: number,
  detail: { adresse_station: string | null; nom_station: string } | null,
): string {
  const address = detail ? formatStationAddress(detail) : null
  return address ?? formatStationCoordinates(lat, lng)
}

export function isFreeAccess(conditionAcces: string): boolean {
  return conditionAcces.trim().toLowerCase() === 'accès libre'
}

export type AvailabilityTone = 'none' | 'available'

export function getAvailabilityTone(availableCount: number): AvailabilityTone {
  return availableCount === 0 ? 'none' : 'available'
}
