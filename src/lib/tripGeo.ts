const EARTH_RADIUS_KM = 6371

export interface LatLng {
  lat: number
  lng: number
}

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Distance à vol d'oiseau entre deux points (km). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/** Longueur totale d'une polyligne GeoJSON [lng, lat][]. */
export function polylineLengthKm(coordinates: [number, number][]): number {
  if (coordinates.length < 2) return 0

  let total = 0
  for (let i = 1; i < coordinates.length; i += 1) {
    const [lng1, lat1] = coordinates[i - 1]!
    const [lng2, lat2] = coordinates[i]!
    total += haversineKm({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 })
  }
  return total
}

function projectScalar(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const abLenSq = abx * abx + aby * aby
  if (abLenSq === 0) return 0
  return Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq))
}

export interface PolylineProjection {
  distanceAlongRouteKm: number
  distanceFromRouteKm: number
}

/** Projette un point sur une polyligne et retourne la distance le long du tracé. */
export function projectPointOnPolyline(
  point: LatLng,
  coordinates: [number, number][],
): PolylineProjection {
  if (coordinates.length === 0) {
    return { distanceAlongRouteKm: 0, distanceFromRouteKm: Infinity }
  }

  if (coordinates.length === 1) {
    const [lng, lat] = coordinates[0]!
    return {
      distanceAlongRouteKm: 0,
      distanceFromRouteKm: haversineKm(point, { lat, lng }),
    }
  }

  let bestAlong = 0
  let bestDist = Infinity
  let traversed = 0

  for (let i = 1; i < coordinates.length; i += 1) {
    const [lng1, lat1] = coordinates[i - 1]!
    const [lng2, lat2] = coordinates[i]!
    const segLen = haversineKm({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 })
    const t = projectScalar(point.lng, point.lat, lng1, lat1, lng2, lat2)
    const closestLng = lng1 + t * (lng2 - lng1)
    const closestLat = lat1 + t * (lat2 - lat1)
    const dist = haversineKm(point, { lat: closestLat, lng: closestLng })

    if (dist < bestDist) {
      bestDist = dist
      bestAlong = traversed + segLen * t
    }

    traversed += segLen
  }

  return {
    distanceAlongRouteKm: bestAlong,
    distanceFromRouteKm: bestDist,
  }
}

/** Point [lng, lat] le long d'une polyligne à la distance cumulée km. */
export function interpolateRoutePointAtKm(
  coordinates: [number, number][],
  km: number,
): [number, number] | null {
  if (coordinates.length === 0) return null
  if (coordinates.length === 1) return coordinates[0]!

  const target = Math.max(0, km)
  let traversed = 0

  for (let i = 1; i < coordinates.length; i += 1) {
    const [lng1, lat1] = coordinates[i - 1]!
    const [lng2, lat2] = coordinates[i]!
    const segLen = haversineKm({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 })

    if (segLen <= 0) continue

    if (traversed + segLen >= target) {
      const t = Math.max(0, Math.min(1, (target - traversed) / segLen))
      return [lng1 + t * (lng2 - lng1), lat1 + t * (lat2 - lat1)]
    }

    traversed += segLen
  }

  return coordinates[coordinates.length - 1] ?? null
}
