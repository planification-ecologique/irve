export interface TripRangeBand {
  startKm: number
  endKm: number
  index: number
}

export function tripRangeBands(routeLengthKm: number, vehicleRangeKm: number): TripRangeBand[] {
  const safeLength = Math.max(routeLengthKm, 1)
  const safeRange = Math.max(vehicleRangeKm, 1)
  const bands: TripRangeBand[] = []

  for (let start = 0, index = 1; start < safeLength; start += safeRange, index += 1) {
    bands.push({
      startKm: start,
      endKm: Math.min(start + safeRange, safeLength),
      index,
    })
  }

  return bands
}

export function stationsOnRouteInKmRange<T extends { distanceAlongRouteKm: number }>(
  stations: T[],
  startKm: number,
  endKm: number,
): T[] {
  return stations.filter(
    (item) =>
      item.distanceAlongRouteKm >= startKm && item.distanceAlongRouteKm <= endKm,
  )
}
