import type { IrvePointsResponse, Station } from '../types/irve'

import exclusions from '../../station-exclusions.json'

const EXCLUDED_STATION_KEYS = new Set(exclusions.stationKeys)

export function isIncludedStation(station: Station): boolean {
  return !EXCLUDED_STATION_KEYS.has(station.station_key)
}

export function sanitizeIrveResponse(data: IrvePointsResponse): IrvePointsResponse {
  const stations = data.stations.filter(isIncludedStation)
  return {
    ...data,
    stations,
    total: stations.length,
  }
}

export type AvailabilityFilter = 'all' | 'available' | 'full'

export function isStationAvailable(station: Station): boolean {
  return station.dynamic_summary.available_count > 0
}

/** Station en service sans aucune prise libre. */
export function isStationFull(station: Station): boolean {
  const dynamic = station.dynamic_summary
  return dynamic.available_count === 0 && dynamic.en_service_count > 0
}

export function matchesAvailabilityFilter(
  station: Station,
  availability: AvailabilityFilter,
): boolean {
  switch (availability) {
    case 'available':
      return isStationAvailable(station)
    case 'full':
      return isStationFull(station)
    default:
      return true
  }
}
