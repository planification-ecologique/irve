import type { StationOnRoute } from './tripCoverage'
import { resolveStationDirectPriceMinPerKwh } from './tripPricing'

export interface RouteDensityBin {
  startKm: number
  endKm: number
  count: number
  pdcCount: number
  stations: StationOnRoute[]
}

export interface RouteDensitySample {
  km: number
  stationCount: number
  pdcCount: number
  availablePdcCount: number
  minPricePerKwh: number | null
}

export interface RouteGapBand {
  startKm: number
  endKm: number
  gapKm: number
}

/** Plafond d'échelle — évite qu'une agglomération écrase le reste du trajet. */
export const MAX_DENSITY_BIN_SCALE = 10

/** Largeur de fenêtre glissante (km) pour la courbe de densité. */
export function rollingWindowKm(routeLengthKm: number): number {
  if (routeLengthKm <= 150) return 25
  if (routeLengthKm <= 400) return 35
  return 50
}

/** Pas d'échantillonnage le long du trajet (km). */
export function rollingSampleStepKm(routeLengthKm: number): number {
  if (routeLengthKm <= 200) return 5
  if (routeLengthKm <= 500) return 8
  return 12
}

/** Seuil d'alerte pour intervalle sans station (km). */
export function routeGapWarningKm(vehicleRangeKm: number): number {
  return Math.round(Math.min(80, vehicleRangeKm * 0.35))
}

/** Largeur de tranche adaptée à la distance totale (~20–30 barres max). */
export function routeDensityBinSizeKm(routeLengthKm: number): number {
  if (routeLengthKm <= 80) return 10
  if (routeLengthKm <= 200) return 15
  if (routeLengthKm <= 400) return 20
  if (routeLengthKm <= 700) return 30
  return 40
}

export function sumRoutePdc(stations: StationOnRoute[]): number {
  return stations.reduce((sum, item) => sum + item.station.pdc_count, 0)
}

export function sumRouteAvailablePdc(stations: StationOnRoute[]): number {
  return stations.reduce((sum, item) => sum + item.station.dynamic_summary.available_count, 0)
}

export function computeRouteDensityBins(
  routeLengthKm: number,
  stations: StationOnRoute[],
  binSizeKm = routeDensityBinSizeKm(routeLengthKm),
): RouteDensityBin[] {
  const safeLength = Math.max(routeLengthKm, 1)
  const safeBin = Math.max(binSizeKm, 1)
  const binCount = Math.max(1, Math.ceil(safeLength / safeBin))
  const bins: RouteDensityBin[] = []

  for (let i = 0; i < binCount; i += 1) {
    const startKm = i * safeBin
    const endKm = Math.min((i + 1) * safeBin, safeLength)
    const inBin = stations.filter((item) => {
      const km = item.distanceAlongRouteKm
      const isLast = i === binCount - 1
      return km >= startKm && (isLast ? km <= endKm : km < endKm)
    })
    bins.push({
      startKm,
      endKm,
      count: inBin.length,
      pdcCount: sumRoutePdc(inBin),
      stations: inBin,
    })
  }

  return bins
}

/** Densité glissante : stations et PDC dans une fenêtre centrée sur chaque point. */
export function computeRollingRouteDensity(
  routeLengthKm: number,
  stations: StationOnRoute[],
  windowKm = rollingWindowKm(routeLengthKm),
  sampleStepKm = rollingSampleStepKm(routeLengthKm),
): RouteDensitySample[] {
  const safeLength = Math.max(routeLengthKm, 1)
  const halfWindow = windowKm / 2
  const samples: RouteDensitySample[] = []

  for (let km = 0; km <= safeLength; km += sampleStepKm) {
    const inWindow = stations.filter(
      (item) =>
        item.distanceAlongRouteKm >= km - halfWindow &&
        item.distanceAlongRouteKm <= km + halfWindow,
    )
    const prices = inWindow
      .map((item) => resolveStationDirectPriceMinPerKwh(item.station))
      .filter((price): price is number => price != null)

    samples.push({
      km,
      stationCount: inWindow.length,
      pdcCount: sumRoutePdc(inWindow),
      availablePdcCount: sumRouteAvailablePdc(inWindow),
      minPricePerKwh: prices.length > 0 ? Math.min(...prices) : null,
    })
  }

  const lastKm = samples[samples.length - 1]?.km ?? 0
  if (lastKm < safeLength) {
    const km = safeLength
    const inWindow = stations.filter(
      (item) =>
        item.distanceAlongRouteKm >= km - halfWindow &&
        item.distanceAlongRouteKm <= km + halfWindow,
    )
    const prices = inWindow
      .map((item) => resolveStationDirectPriceMinPerKwh(item.station))
      .filter((price): price is number => price != null)

    samples.push({
      km,
      stationCount: inWindow.length,
      pdcCount: sumRoutePdc(inWindow),
      availablePdcCount: sumRouteAvailablePdc(inWindow),
      minPricePerKwh: prices.length > 0 ? Math.min(...prices) : null,
    })
  }

  return samples
}

/** Intervalles sans aucune station le long du trajet. */
export function computeSparseRouteBands(
  samples: RouteDensitySample[],
): { startKm: number; endKm: number }[] {
  const bands: { startKm: number; endKm: number }[] = []
  let openStart: number | null = null

  for (const sample of samples) {
    if (sample.stationCount === 0) {
      if (openStart === null) openStart = sample.km
    } else if (openStart !== null) {
      bands.push({ startKm: openStart, endKm: sample.km })
      openStart = null
    }
  }

  if (openStart !== null && samples.length > 0) {
    bands.push({ startKm: openStart, endKm: samples[samples.length - 1]!.km })
  }

  return bands
}

/** Intervalles entre stations consécutives ≥ seuil. Entrée triée par distanceAlongRouteKm. */
export function computeRouteGapBands(
  routeLengthKm: number,
  stations: StationOnRoute[],
  warnGapKm: number,
): RouteGapBand[] {
  const bands: RouteGapBand[] = []
  let prevKm = 0

  for (const item of stations) {
    const gap = item.distanceAlongRouteKm - prevKm
    if (gap >= warnGapKm) {
      bands.push({ startKm: prevKm, endKm: item.distanceAlongRouteKm, gapKm: gap })
    }
    prevKm = item.distanceAlongRouteKm
  }

  const endGap = routeLengthKm - prevKm
  if (endGap >= warnGapKm) {
    bands.push({ startKm: prevKm, endKm: routeLengthKm, gapKm: endGap })
  }

  return bands
}

export function routeDensityScaleMax(values: readonly number[]): number {
  const rawMax = values.length > 0 ? Math.max(...values) : 0
  return Math.max(1, Math.min(rawMax, MAX_DENSITY_BIN_SCALE))
}

export function routeDensityValueHeight(
  value: number,
  scaleMax: number,
  plotHeight: number,
): number {
  const capped = Math.min(value, scaleMax)
  return (capped / scaleMax) * (plotHeight - 8)
}

export function isDensityValueCapped(value: number, scaleMax: number): boolean {
  return value > scaleMax
}

export function routeDensityTickStepKm(routeLengthKm: number): number {
  if (routeLengthKm <= 120) return 20
  if (routeLengthKm <= 300) return 50
  if (routeLengthKm <= 600) return 100
  return 150
}

export function routeDensityTicks(routeLengthKm: number): number[] {
  const step = routeDensityTickStepKm(routeLengthKm)
  const ticks: number[] = [0]
  for (let km = step; km < routeLengthKm; km += step) {
    ticks.push(km)
  }
  if (ticks[ticks.length - 1] !== routeLengthKm) {
    ticks.push(routeLengthKm)
  }
  return ticks
}

export function buildSvgLinePath(
  points: { x: number; y: number }[],
): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  return `M ${first!.x} ${first!.y}${rest.map((p) => ` L ${p.x} ${p.y}`).join('')}`
}

/** Tracés séparés quand la série contient des trous (prix manquants). */
export function buildSvgLinePathsWithGaps(
  points: { x: number; y: number | null }[],
): string[] {
  const paths: string[] = []
  let current: { x: number; y: number }[] = []

  for (const point of points) {
    if (point.y == null) {
      if (current.length >= 2) paths.push(buildSvgLinePath(current))
      current = []
      continue
    }
    current.push({ x: point.x, y: point.y })
  }

  if (current.length >= 2) paths.push(buildSvgLinePath(current))
  return paths
}

export function routePriceScale(prices: readonly number[]): { min: number; max: number } {
  const filtered = prices.filter((price) => Number.isFinite(price))
  if (filtered.length === 0) return { min: 0.25, max: 0.65 }

  const rawMin = Math.min(...filtered)
  const rawMax = Math.max(...filtered)
  let min = Math.floor(rawMin * 20) / 20 - 0.03
  let max = Math.ceil(rawMax * 20) / 20 + 0.03
  min = Math.max(0.15, min)
  if (max - min < 0.12) max = min + 0.12
  return { min, max }
}

export function routePriceY(
  price: number,
  scale: { min: number; max: number },
  plotHeight: number,
  padTop: number,
): number {
  const range = scale.max - scale.min
  if (range <= 0) return padTop + plotHeight
  const t = (price - scale.min) / range
  return padTop + plotHeight - t * (plotHeight - 8)
}

export function formatPriceAxisTick(value: number): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
