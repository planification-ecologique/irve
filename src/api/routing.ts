import { polylineLengthKm } from '../lib/tripGeo'

export interface RouteResult {
  coordinates: [number, number][]
  distanceKm: number
  durationMinutes: number
}

interface OsrmRouteResponse {
  code: string
  routes?: {
    geometry: {
      coordinates: [number, number][]
    }
    distance: number
    duration: number
  }[]
  message?: string
}

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

export async function fetchDrivingRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<RouteResult> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'false',
  })

  const response = await fetch(`${OSRM_BASE}/${coords}?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Itinéraire indisponible (${response.status})`)
  }

  const data = (await response.json()) as OsrmRouteResponse
  if (data.code !== 'Ok' || !data.routes?.[0]) {
    throw new Error(data.message ?? 'Aucun itinéraire trouvé entre ces deux points.')
  }

  const route = data.routes[0]
  const coordinates = route.geometry.coordinates
  const distanceKm =
    route.distance > 0
      ? route.distance / 1000
      : polylineLengthKm(coordinates)

  return {
    coordinates,
    distanceKm: Math.round(distanceKm),
    durationMinutes: Math.round(route.duration / 60),
  }
}
