export interface GeocodedPlace {
  label: string
  lat: number
  lng: number
  city: string
  score: number
}

interface BanFeature {
  properties: {
    label: string
    score: number
    city?: string
    name?: string
    type?: string
  }
  geometry: {
    coordinates: [number, number]
  }
}

interface BanSearchResponse {
  features: BanFeature[]
}

const BAN_SEARCH_URL = 'https://api-adresse.data.gouv.fr/search/'

/** Commune avec arrondissements (Paris, Lyon, Marseille) — hors suggestions trajets. */
export function isBanArrondissement(name: string): boolean {
  return /\d+(?:er|e|ème)\s+arrondissement/i.test(name.trim())
}

function isArrondissementFeature(feature: BanFeature): boolean {
  const { city, name } = feature.properties
  return isBanArrondissement(city ?? '') || isBanArrondissement(name ?? '')
}

/** Nom de commune affichable (sans adresse postale). */
export function cityNameFromBanFeature(feature: BanFeature): string {
  const { city, name, label, type } = feature.properties
  if (city?.trim()) return city.trim()
  if (type === 'municipality' && name?.trim()) return name.trim()

  const lastPart = label.split(',').pop()?.trim() ?? label
  return lastPart.replace(/^\d{5}\s*/, '').trim() || label
}

export async function searchPlaces(query: string, limit = 6): Promise<GeocodedPlace[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const params = new URLSearchParams({
    q: trimmed,
    limit: String(Math.max(limit * 3, 12)),
    autocomplete: '1',
    type: 'municipality',
  })

  const response = await fetch(`${BAN_SEARCH_URL}?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Géocodage indisponible (${response.status})`)
  }

  const data = (await response.json()) as BanSearchResponse
  const seen = new Set<string>()
  const results: GeocodedPlace[] = []

  for (const feature of data.features) {
    if (isArrondissementFeature(feature)) continue

    const [lng, lat] = feature.geometry.coordinates
    const city = cityNameFromBanFeature(feature)
    const key = city.toLocaleLowerCase('fr-FR')
    if (seen.has(key)) continue
    seen.add(key)

    results.push({
      label: city,
      lat,
      lng,
      city,
      score: feature.properties.score,
    })

    if (results.length >= limit) break
  }

  return results
}

export async function geocodePlace(query: string): Promise<GeocodedPlace | null> {
  const results = await searchPlaces(query, 1)
  return results[0] ?? null
}
