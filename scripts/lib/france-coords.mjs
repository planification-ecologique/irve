/** Emprise métropolitaine + Corse (stations IRVE en France). */
export const FRANCE_BBOX = {
  latMin: 41.0,
  latMax: 51.6,
  lngMin: -5.2,
  lngMax: 9.6,
}

export function inFranceBBox(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= FRANCE_BBOX.latMin &&
    lat <= FRANCE_BBOX.latMax &&
    lng >= FRANCE_BBOX.lngMin &&
    lng <= FRANCE_BBOX.lngMax
  )
}

/**
 * Corrige lat/lng inversés (ex. lon/lat permutés dans coordonneesXY).
 * @returns {{ lat: number, lng: number, swapped: boolean } | null}
 */
export function normalizeFranceCoords(lat, lng) {
  const a = Number(lat)
  const b = Number(lng)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (inFranceBBox(a, b)) return { lat: a, lng: b, swapped: false }
  if (inFranceBBox(b, a)) return { lat: b, lng: a, swapped: true }
  return null
}

/** Parse coordonneesXY IRVE — tente [lng,lat] puis [lat,lng]. */
export function parseCoordonneesXY(raw) {
  const match = String(raw ?? '').match(/\[?\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\]?/)
  if (!match) return null
  const first = Number.parseFloat(match[1])
  const second = Number.parseFloat(match[2])
  return (
    normalizeFranceCoords(second, first) ??
    normalizeFranceCoords(first, second)
  )
}
