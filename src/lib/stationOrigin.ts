import type { Station } from '../types/irve'

export function isStaticStation(station: Station): boolean {
  return station.data_origin === 'transport-static'
}

export function mergeStationLists(
  liveStations: Station[],
  slowStations: Station[],
): Station[] {
  const byKey = new Map<string, Station>()

  for (const station of slowStations) {
    byKey.set(station.station_key, station)
  }
  for (const station of liveStations) {
    byKey.set(station.station_key, station)
  }

  return [...byKey.values()]
}
