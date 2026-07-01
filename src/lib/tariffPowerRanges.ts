import {
  pickDirectTier,
  type OperatorTariff,
} from '../data/operatorTariffs'
import type { Station } from '../types/irve'
import {
  formatTariffTierPrice,
  getStationPricePerKwhBounds,
  tariffHasDisplayablePrice,
} from './tariffDisplay'

export interface TariffPowerRange {
  id: string
  label: string
  matchesStationMaxPowerKw: (maxPowerKw: number) => boolean
  /** Puissance de référence pour lire la grille opérateur (pickDirectTier). */
  samplePowerKw: number
  color: string
}

/** Paliers alignés sur les grilles CPO (AC / DC50 / DC150 / HPC). */
export const TARIFF_POWER_RANGES: readonly TariffPowerRange[] = [
  {
    id: 'ac',
    label: '≤ 22 kW',
    matchesStationMaxPowerKw: (p) => p > 0 && p <= 22,
    samplePowerKw: 11,
    color: '#60a5fa',
  },
  {
    id: 'dc50',
    label: '23–50 kW',
    matchesStationMaxPowerKw: (p) => p > 22 && p <= 50,
    samplePowerKw: 36,
    color: '#38bdf8',
  },
  {
    id: 'dc150',
    label: '51–150 kW',
    matchesStationMaxPowerKw: (p) => p > 50 && p <= 150,
    samplePowerKw: 100,
    color: '#22d3a5',
  },
  {
    id: 'hpc',
    label: '> 150 kW',
    matchesStationMaxPowerKw: (p) => p > 150,
    samplePowerKw: 200,
    color: '#fbbf24',
  },
] as const

/** Nombre de stations par palier (puissance max. de la station). */
export function countStationsPerTariffRange(stations: Station[]): Map<string, number> {
  const counts = new Map(TARIFF_POWER_RANGES.map((r) => [r.id, 0]))

  for (const station of stations) {
    const maxPower = station.summary?.max_power ?? 0
    if (maxPower <= 0) continue
    const range = TARIFF_POWER_RANGES.find((r) => r.matchesStationMaxPowerKw(maxPower))
    if (range) counts.set(range.id, (counts.get(range.id) ?? 0) + 1)
  }

  return counts
}

/** Paliers à afficher : au moins une station dans le jeu courant. */
export function activeTariffPowerRangesForStations(stations: Station[]): TariffPowerRange[] {
  const counts = countStationsPerTariffRange(stations)
  return TARIFF_POWER_RANGES.filter((r) => (counts.get(r.id) ?? 0) > 0)
}

export interface RangeWeightedAverage {
  rangeId: string
  avgPrice: number | null
  pdcCount: number
  stationCount: number
}

export interface TariffRangeBoxPlot {
  rangeId: string
  pdcCount: number
  pricedPdcCount: number
  stationCount: number
  q1: number
  median: number
  q3: number
  lowerWhisker: number
  upperWhisker: number
  outliers: number[]
}

interface WeightedPriceSample {
  value: number
  weight: number
}

function weightedPercentile(samples: WeightedPriceSample[], p: number): number {
  const sorted = [...samples].sort((a, b) => a.value - b.value)
  const total = sorted.reduce((sum, s) => sum + s.weight, 0)
  const target = total * p
  let cumulative = 0
  for (const sample of sorted) {
    cumulative += sample.weight
    if (cumulative >= target) return sample.value
  }
  return sorted[sorted.length - 1]?.value ?? 0
}

function computeWeightedBoxPlot(
  samples: WeightedPriceSample[],
  stationCount: number,
  pdcCount: number,
): TariffRangeBoxPlot | null {
  if (samples.length === 0) return null

  const pricedPdc = samples.reduce((sum, s) => sum + s.weight, 0)
  if (pricedPdc <= 0) return null

  const q1 = weightedPercentile(samples, 0.25)
  const median = weightedPercentile(samples, 0.5)
  const q3 = weightedPercentile(samples, 0.75)
  const iqr = q3 - q1
  const lowerFence = q1 - 1.5 * iqr
  const upperFence = q3 + 1.5 * iqr

  const values = samples.map((s) => s.value)
  const inFence = values.filter((v) => v >= lowerFence && v <= upperFence)
  const lowerWhisker = inFence.length > 0 ? Math.min(...inFence) : Math.min(...values)
  const upperWhisker = inFence.length > 0 ? Math.max(...inFence) : Math.max(...values)
  const outliers = [...new Set(values.filter((v) => v < lowerFence || v > upperFence))].sort(
    (a, b) => a - b,
  )

  return {
    rangeId: '',
    pdcCount,
    pricedPdcCount: pricedPdc,
    stationCount,
    q1,
    median,
    q3,
    lowerWhisker,
    upperWhisker,
    outliers,
  }
}

/** Moyenne €/kWh direct par palier, pondérée par `pdc_count` (bornes). */
export function computeWeightedTariffAverages(stations: Station[]): RangeWeightedAverage[] {
  const acc = new Map<string, { priceSum: number; pdc: number; stations: number }>()
  for (const range of TARIFF_POWER_RANGES) {
    acc.set(range.id, { priceSum: 0, pdc: 0, stations: 0 })
  }

  for (const station of stations) {
    const maxPower = station.summary?.max_power ?? 0
    if (maxPower <= 0) continue

    const range = TARIFF_POWER_RANGES.find((r) => r.matchesStationMaxPowerKw(maxPower))
    if (!range) continue

    const bounds = getStationPricePerKwhBounds(station)
    if (!bounds) continue

    const bucket = acc.get(range.id)!
    bucket.priceSum += bounds.min * station.pdc_count
    bucket.pdc += station.pdc_count
    bucket.stations += 1
  }

  return TARIFF_POWER_RANGES.map((range) => {
    const bucket = acc.get(range.id)!
    return {
      rangeId: range.id,
      avgPrice: bucket.pdc > 0 ? bucket.priceSum / bucket.pdc : null,
      pdcCount: bucket.pdc,
      stationCount: bucket.stations,
    }
  })
}

/** Box plot (moustaches) par palier — quartiles pondérés par `pdc_count`. */
export function computeTariffRangeBoxPlots(stations: Station[]): TariffRangeBoxPlot[] {
  const samplesByRange = new Map<string, WeightedPriceSample[]>()
  const stationsByRange = new Map<string, number>()
  const pdcByRange = new Map<string, number>()

  for (const range of TARIFF_POWER_RANGES) {
    samplesByRange.set(range.id, [])
    stationsByRange.set(range.id, 0)
    pdcByRange.set(range.id, 0)
  }

  for (const station of stations) {
    const maxPower = station.summary?.max_power ?? 0
    if (maxPower <= 0) continue

    const range = TARIFF_POWER_RANGES.find((r) => r.matchesStationMaxPowerKw(maxPower))
    if (!range) continue

    pdcByRange.set(range.id, (pdcByRange.get(range.id) ?? 0) + station.pdc_count)

    const bounds = getStationPricePerKwhBounds(station)
    if (!bounds) continue

    samplesByRange.get(range.id)!.push({ value: bounds.min, weight: station.pdc_count })
    stationsByRange.set(range.id, (stationsByRange.get(range.id) ?? 0) + 1)
  }

  return TARIFF_POWER_RANGES.map((range) => {
    const plot = computeWeightedBoxPlot(
      samplesByRange.get(range.id) ?? [],
      stationsByRange.get(range.id) ?? 0,
      pdcByRange.get(range.id) ?? 0,
    )
    if (!plot) {
      return {
        rangeId: range.id,
        pdcCount: pdcByRange.get(range.id) ?? 0,
        pricedPdcCount: 0,
        stationCount: 0,
        q1: 0,
        median: 0,
        q3: 0,
        lowerWhisker: 0,
        upperWhisker: 0,
        outliers: [],
      }
    }
    return { ...plot, rangeId: range.id }
  })
}

/** Origine de l’axe €/kWh du box plot (zoom sur la fourchette observée). */
export const TARIFF_BOX_PLOT_SCALE_MIN = 0.25

export function tariffBoxPlotScale(boxPlots: TariffRangeBoxPlot[]): { min: number; max: number } {
  const min = TARIFF_BOX_PLOT_SCALE_MIN
  const caps = boxPlots
    .filter((b) => b.pricedPdcCount > 0)
    .flatMap((b) => [b.lowerWhisker, b.upperWhisker, ...b.outliers])
  const maxRaw = caps.length === 0 ? 0.7 : Math.max(...caps)
  const max = Math.ceil(maxRaw * 100) / 100 + 0.02
  return { min, max: Math.max(max, min + 0.15) }
}

export function getOperatorDirectPriceForRange(
  tariff: OperatorTariff,
  range: TariffPowerRange,
): number | null {
  if (!tariffHasDisplayablePrice(tariff)) return null
  const tier = pickDirectTier(tariff, range.samplePowerKw)
  if (!tier || tier.unit !== '€/kWh') return null
  return tier.value
}

/** Libellé cellule tableau (prix fixe ou fourchette). */
export function formatOperatorDirectPriceForRange(
  tariff: OperatorTariff,
  range: TariffPowerRange,
): string | null {
  if (!tariffHasDisplayablePrice(tariff)) return null
  const tier = pickDirectTier(tariff, range.samplePowerKw)
  if (!tier || tier.unit !== '€/kWh') return null
  return formatTariffTierPrice(tier)
}

/** Nombre de stations QualiCharge par fiche opérateur (`match`). */
export function computeStationCountsByTariff(
  stations: readonly Station[],
  tariffs: readonly OperatorTariff[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const tariff of tariffs) {
    const names = new Set(tariff.match)
    const n = stations.filter(
      (s) => s.nom_operateur != null && names.has(s.nom_operateur),
    ).length
    counts.set(tariff.id, n)
  }
  return counts
}

/** Stations dont le `nom_operateur` est couvert par au moins une fiche listée. */
export function countStationsCoveredByTariffs(
  stations: readonly Station[],
  tariffs: readonly OperatorTariff[],
): number {
  const names = new Set<string>()
  for (const tariff of tariffs) {
    for (const n of tariff.match) names.add(n)
  }
  return stations.filter((s) => s.nom_operateur != null && names.has(s.nom_operateur))
    .length
}
