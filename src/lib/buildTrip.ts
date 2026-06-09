import { geocodePlace, type GeocodedPlace } from '../api/geocoding'
import { fetchDrivingRoute } from '../api/routing'
import type { Station } from '../types/irve'
import type { SavedTrip, TripPlace } from '../types/trip'
import {
  DEFAULT_CORRIDOR_KM,
  DEFAULT_TRIP_MIN_POWER_KW,
  DEFAULT_VEHICLE_RANGE_KM,
} from '../types/trip'
import { randomId } from './randomId'
import { computeCoverageScore, findStationsOnRoute } from './tripCoverage'

export interface BuildTripInput {
  fromQuery: string
  toQuery: string
  fromPlace?: GeocodedPlace | null
  toPlace?: GeocodedPlace | null
  vehicleRangeKm?: number
  minPowerKw?: number
  corridorKm?: number
}

function toTripPlace(place: GeocodedPlace): TripPlace {
  return {
    label: place.city,
    lat: place.lat,
    lng: place.lng,
  }
}

export async function buildSavedTrip(
  input: BuildTripInput,
  stations: Station[],
): Promise<SavedTrip> {
  const from =
    input.fromPlace ??
    (await geocodePlace(input.fromQuery)) ??
    (() => {
      throw new Error(`Départ introuvable : « ${input.fromQuery.trim()} »`)
    })()

  const to =
    input.toPlace ??
    (await geocodePlace(input.toQuery)) ??
    (() => {
      throw new Error(`Arrivée introuvable : « ${input.toQuery.trim()} »`)
    })()

  const route = await fetchDrivingRoute(from, to)
  const vehicleRangeKm = input.vehicleRangeKm ?? DEFAULT_VEHICLE_RANGE_KM
  const minPowerKw = input.minPowerKw ?? DEFAULT_TRIP_MIN_POWER_KW
  const corridorKm = input.corridorKm ?? DEFAULT_CORRIDOR_KM

  const onRoute = findStationsOnRoute(stations, route.coordinates, {
    corridorKm,
    minPowerKw,
  })

  const coverage = computeCoverageScore(route.distanceKm, onRoute, vehicleRangeKm)

  return {
    id: randomId(),
    from: toTripPlace(from),
    to: toTripPlace(to),
    vehicleRangeKm,
    minPowerKw,
    corridorKm,
    createdAt: new Date().toISOString(),
    routeCoordinates: route.coordinates,
    routeDistanceKm: route.distanceKm,
    routeDurationMinutes: route.durationMinutes,
    coverageScore: coverage.score,
    coverageGrade: coverage.grade,
    coveredSegmentCount: coverage.coveredSegmentCount,
    segmentCount: coverage.segmentCount,
    maxGapKm: coverage.maxGapKm,
    stationCount: coverage.stationCount,
    stationKeys: onRoute.map((item) => item.station.station_key),
  }
}

export function tripLabel(trip: SavedTrip): string {
  return `${formatTripCityLabel(trip.from.label)} → ${formatTripCityLabel(trip.to.label)}`
}

/** Compat trajets session avec anciennes adresses complètes. */
export function formatTripCityLabel(label: string): string {
  const lastPart = label.split(',').pop()?.trim() ?? label
  return lastPart.replace(/^\d{5}\s*/, '').trim() || label
}
