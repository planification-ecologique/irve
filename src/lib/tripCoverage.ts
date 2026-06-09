import type { Station } from '../types/irve'
import type { CoverageGrade } from '../types/trip'
import { projectPointOnPolyline } from './tripGeo'

export interface StationOnRoute {
  station: Station
  distanceAlongRouteKm: number
  distanceFromRouteKm: number
}

export interface CoverageResult {
  score: number
  grade: CoverageGrade
  routeLengthKm: number
  stationCount: number
  segmentCount: number
  coveredSegmentCount: number
  maxGapKm: number
}

export interface FindStationsOnRouteOptions {
  corridorKm: number
  minPowerKw: number
}

export function findStationsOnRoute(
  stations: Station[],
  routeCoordinates: [number, number][],
  options: FindStationsOnRouteOptions,
): StationOnRoute[] {
  const { corridorKm, minPowerKw } = options
  const onRoute: StationOnRoute[] = []

  for (const station of stations) {
    if (station.summary.max_power < minPowerKw) continue

    const projection = projectPointOnPolyline(
      { lat: station.lat, lng: station.lng },
      routeCoordinates,
    )

    if (projection.distanceFromRouteKm > corridorKm) continue

    onRoute.push({
      station,
      distanceAlongRouteKm: projection.distanceAlongRouteKm,
      distanceFromRouteKm: projection.distanceFromRouteKm,
    })
  }

  onRoute.sort((a, b) => a.distanceAlongRouteKm - b.distanceAlongRouteKm)
  return onRoute
}

export function coverageGradeFromScore(score: number): CoverageGrade {
  if (score >= 95) return 'excellent'
  if (score >= 75) return 'good'
  if (score >= 50) return 'fair'
  return 'poor'
}

/** Score de couverture : part de tronçons (autonomie) avec au moins une borne sur le trajet. */
export function computeCoverageScore(
  routeLengthKm: number,
  stationsOnRoute: StationOnRoute[],
  vehicleRangeKm: number,
): CoverageResult {
  const safeRange = Math.max(vehicleRangeKm, 1)
  const segmentCount = Math.max(1, Math.ceil(routeLengthKm / safeRange))

  if (stationsOnRoute.length === 0) {
    return {
      score: 0,
      grade: 'poor',
      routeLengthKm,
      stationCount: 0,
      segmentCount,
      coveredSegmentCount: 0,
      maxGapKm: routeLengthKm,
    }
  }

  let coveredSegmentCount = 0
  for (let i = 0; i < segmentCount; i += 1) {
    const segStart = i * safeRange
    const segEnd = Math.min((i + 1) * safeRange, routeLengthKm)
    const covered = stationsOnRoute.some(
      (item) =>
        item.distanceAlongRouteKm >= segStart &&
        item.distanceAlongRouteKm <= segEnd,
    )
    if (covered) coveredSegmentCount += 1
  }

  const score = Math.round((coveredSegmentCount / segmentCount) * 100)
  const maxGapKm = computeMaxGapKm(routeLengthKm, stationsOnRoute)

  return {
    score,
    grade: coverageGradeFromScore(score),
    routeLengthKm,
    stationCount: stationsOnRoute.length,
    segmentCount,
    coveredSegmentCount,
    maxGapKm,
  }
}

function computeMaxGapKm(
  routeLengthKm: number,
  stationsOnRoute: StationOnRoute[],
): number {
  if (stationsOnRoute.length === 0) return routeLengthKm

  const positions = stationsOnRoute.map((item) => item.distanceAlongRouteKm)
  let maxGap = positions[0]!
  for (let i = 1; i < positions.length; i += 1) {
    maxGap = Math.max(maxGap, positions[i]! - positions[i - 1]!)
  }
  maxGap = Math.max(maxGap, routeLengthKm - positions[positions.length - 1]!)
  return Math.round(maxGap)
}
