import type { Station } from '../types/irve'
import type { CoverageGrade } from '../types/trip'
import { computeStopZonePriceEstimate } from './tripPricing'
import { stationsOnRouteInKmRange } from './tripSegments'
import { projectPointOnPolyline, toRad } from './tripGeo'

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

export interface TripLikelyStopZone {
  centerKm: number
  zoneStartKm: number
  zoneEndKm: number
  stations: StationOnRoute[]
  stationCount: number
  pdcCount: number
}

export interface TripChargeStop {
  /** 1-based — Arrêt 1, Arrêt 2… */
  index: number
  startKm: number
  endKm: number
  covered: boolean
  stationCount: number
  pdcCount: number
  likelyStop: TripLikelyStopZone | null
  minPricePerKwh: number | null
  avgPricePerKwh: number | null
}

export interface FindStationsOnRouteOptions {
  corridorKm: number
  minPowerKw: number
}

interface RouteBoundingBox {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

const KM_PER_DEG_LAT = 111

function routeBoundingBox(
  routeCoordinates: [number, number][],
  corridorKm: number,
): RouteBoundingBox | null {
  if (routeCoordinates.length === 0) return null

  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity

  for (const [lng, lat] of routeCoordinates) {
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
  }

  const midLat = (minLat + maxLat) / 2
  const latPad = corridorKm / KM_PER_DEG_LAT
  const lngPad = corridorKm / (KM_PER_DEG_LAT * Math.max(Math.cos(toRad(midLat)), 0.01))

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  }
}

function isStationInBoundingBox(station: Station, bbox: RouteBoundingBox): boolean {
  return (
    station.lat >= bbox.minLat &&
    station.lat <= bbox.maxLat &&
    station.lng >= bbox.minLng &&
    station.lng <= bbox.maxLng
  )
}

export function buildStationLookup(stations: Station[]): Map<string, Station> {
  const lookup = new Map<string, Station>()
  for (const station of stations) {
    lookup.set(station.station_key, station)
  }
  return lookup
}

function projectStationOnRoute(
  station: Station,
  routeCoordinates: [number, number][],
  corridorKm: number,
): StationOnRoute | null {
  const projection = projectPointOnPolyline(
    { lat: station.lat, lng: station.lng },
    routeCoordinates,
  )

  if (projection.distanceFromRouteKm > corridorKm) return null

  return {
    station,
    distanceAlongRouteKm: projection.distanceAlongRouteKm,
    distanceFromRouteKm: projection.distanceFromRouteKm,
  }
}

function projectStationsOnRoute(
  candidates: Iterable<Station>,
  routeCoordinates: [number, number][],
  options: FindStationsOnRouteOptions,
  bbox: RouteBoundingBox | null = null,
): StationOnRoute[] {
  const { corridorKm, minPowerKw } = options
  const onRoute: StationOnRoute[] = []

  for (const station of candidates) {
    if (station.summary.max_power < minPowerKw) continue
    if (bbox && !isStationInBoundingBox(station, bbox)) continue

    const projected = projectStationOnRoute(station, routeCoordinates, corridorKm)
    if (projected) onRoute.push(projected)
  }

  return onRoute.sort((a, b) => a.distanceAlongRouteKm - b.distanceAlongRouteKm)
}

/** Cible de recharge par leg (~88 % autonomie), alignée sur findChargeStopZone. */
export const CHARGE_LEG_FACTOR = 0.88

export function findStationsOnRoute(
  stations: Station[],
  routeCoordinates: [number, number][],
  options: FindStationsOnRouteOptions,
): StationOnRoute[] {
  const bbox = routeBoundingBox(routeCoordinates, options.corridorKm)
  return projectStationsOnRoute(stations, routeCoordinates, options, bbox)
}

function refreshStationsOnRoute(
  stationLookup: Map<string, Station>,
  stationKeys: string[],
  routeCoordinates: [number, number][],
  options: FindStationsOnRouteOptions,
): StationOnRoute[] {
  const candidates: Station[] = []
  for (const key of stationKeys) {
    const station = stationLookup.get(key)
    if (station) candidates.push(station)
  }
  return projectStationsOnRoute(candidates, routeCoordinates, options)
}

export function resolveStationsOnRoute(
  stations: Station[],
  routeCoordinates: [number, number][],
  options: FindStationsOnRouteOptions,
  stationKeys?: string[],
  stationLookup?: Map<string, Station>,
): StationOnRoute[] {
  if (stationKeys && stationKeys.length > 0) {
    return refreshStationsOnRoute(
      stationLookup ?? buildStationLookup(stations),
      stationKeys,
      routeCoordinates,
      options,
    )
  }

  return findStationsOnRoute(stations, routeCoordinates, options)
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

function pdcWeightedCenterKm(stations: StationOnRoute[]): number {
  if (stations.length === 0) return 0
  const totalPdc = stations.reduce((sum, item) => sum + item.station.pdc_count, 0)
  if (totalPdc <= 0) {
    const avg =
      stations.reduce((sum, item) => sum + item.distanceAlongRouteKm, 0) / stations.length
    return avg
  }
  return (
    stations.reduce(
      (sum, item) => sum + item.distanceAlongRouteKm * item.station.pdc_count,
      0,
    ) / totalPdc
  )
}

function buildLikelyStopZone(
  zoneStartKm: number,
  zoneEndKm: number,
  stations: StationOnRoute[],
): TripLikelyStopZone | null {
  if (stations.length === 0) return null

  const centerKm = Math.min(
    zoneEndKm,
    Math.max(zoneStartKm, pdcWeightedCenterKm(stations)),
  )

  return {
    centerKm,
    zoneStartKm,
    zoneEndKm,
    stations,
    stationCount: stations.length,
    pdcCount: stations.reduce((sum, item) => sum + item.station.pdc_count, 0),
  }
}

function findChargeStopZone(
  segmentStartKm: number,
  segmentEndKm: number,
  inSegment: StationOnRoute[],
  vehicleRangeKm: number,
): TripLikelyStopZone | null {
  if (inSegment.length === 0) return null

  const targetKm = Math.min(segmentEndKm - 5, segmentStartKm + vehicleRangeKm * CHARGE_LEG_FACTOR)
  const windowKm = Math.min(50, vehicleRangeKm * 0.15)
  let zoneStartKm = Math.max(segmentStartKm, targetKm - windowKm)
  let zoneEndKm = Math.min(segmentEndKm, targetKm + windowKm)
  let inZone = stationsOnRouteInKmRange(inSegment, zoneStartKm, zoneEndKm)

  if (inZone.length === 0) {
    const anchor = inSegment.reduce((best, item) =>
      item.station.pdc_count > best.station.pdc_count ? item : best,
    )
    zoneStartKm = Math.max(segmentStartKm, anchor.distanceAlongRouteKm - 25)
    zoneEndKm = Math.min(segmentEndKm, anchor.distanceAlongRouteKm + 25)
    inZone = stationsOnRouteInKmRange(inSegment, zoneStartKm, zoneEndKm)
  }

  return buildLikelyStopZone(zoneStartKm, zoneEndKm, inZone)
}

interface ChargeLeg {
  legStartKm: number
  legEndKm: number
  targetKm: number
}

function computeChargeLegs(routeLengthKm: number, vehicleRangeKm: number): ChargeLeg[] {
  const safeLength = Math.max(routeLengthKm, 0)
  const safeRange = Math.max(vehicleRangeKm, 1)

  if (safeLength <= safeRange) return []

  const legs: ChargeLeg[] = []
  let positionKm = 0

  while (positionKm + safeRange < safeLength) {
    const legStartKm = positionKm
    const targetKm = Math.min(legStartKm + safeRange * CHARGE_LEG_FACTOR, safeLength - 5)
    const legEndKm = Math.min(legStartKm + safeRange, safeLength)
    legs.push({ legStartKm, legEndKm, targetKm })
    positionKm = targetKm
  }

  return legs
}

/** Arrêts recharge rapide — simulation leg par leg (recharge à ~88 % autonomie). */
export function tripChargeStopCount(routeLengthKm: number, vehicleRangeKm: number): number {
  return computeChargeLegs(routeLengthKm, vehicleRangeKm).length
}

/** Zones d'arrêt recharge rapide le long du trajet (hors arrivée). */
export function computeTripChargeStops(
  routeLengthKm: number,
  stationsOnRoute: StationOnRoute[],
  vehicleRangeKm: number,
): TripChargeStop[] {
  const safeRange = Math.max(vehicleRangeKm, 1)
  const legs = computeChargeLegs(routeLengthKm, vehicleRangeKm)

  return legs.map((leg, index) => {
    const inLeg = stationsOnRouteInKmRange(stationsOnRoute, leg.legStartKm, leg.legEndKm)
    const likelyStop = findChargeStopZone(leg.legStartKm, leg.legEndKm, inLeg, safeRange)
    const zoneStations = likelyStop?.stations.map((item) => item.station) ?? []
    const price = computeStopZonePriceEstimate(zoneStations)

    return {
      index: index + 1,
      startKm: leg.legStartKm,
      endKm: leg.legEndKm,
      covered: inLeg.length > 0,
      stationCount: inLeg.length,
      pdcCount: inLeg.reduce((sum, item) => sum + item.station.pdc_count, 0),
      likelyStop,
      minPricePerKwh: price.minPricePerKwh,
      avgPricePerKwh: price.avgPricePerKwh,
    }
  })
}
