import type { Station } from '../types/irve'

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
