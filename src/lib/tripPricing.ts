import { getOperatorTariff, pickDirectTier } from '../data/operatorTariffs'
import type { Station } from '../types/irve'
import { tariffHasDisplayablePrice } from './tariffDisplay'

export interface TripPriceSummary {
  /** Moyenne €/kWh CB direct, pondérée par PDC. */
  avgPricePerKwh: number | null
  /** Médiane pondérée €/kWh. */
  medianPricePerKwh: number | null
  minPricePerKwh: number | null
  maxPricePerKwh: number | null
  pricedPdcCount: number
  totalPdcCount: number
  pricedStationCount: number
  totalStationCount: number
  /** Part des PDC du trajet avec un tarif direct documenté (0–100). */
  coveragePct: number
}

export interface TripSegmentPrice {
  startKm: number
  endKm: number
  minPricePerKwh: number | null
  pricedStationCount: number
  stationCount: number
}

export interface StopZonePriceEstimate {
  minPricePerKwh: number | null
  avgPricePerKwh: number | null
  pricedStationCount: number
}

interface PriceSample {
  value: number
  weight: number
}

/** Prix plancher €/kWh (borne basse des fourchettes opérateur). */
export function resolveStationDirectPriceMinPerKwh(station: Station): number | null {
  const { summary } = station
  if (!summary) return null
  if (summary.price_per_kwh != null) return summary.price_per_kwh
  if (summary.pricing_value != null && summary.pricing_unit === '€/kWh') {
    return summary.pricing_value
  }

  const tariff = getOperatorTariff(station.nom_operateur)
  if (!tariff || !tariffHasDisplayablePrice(tariff)) return null

  const tier = pickDirectTier(tariff, summary.max_power)
  if (!tier || tier.unit !== '€/kWh') return null

  return tier.value
}

/** Prix direct €/kWh pour une station (QualiCharge live, sinon grille opérateur). */
export function resolveStationDirectPricePerKwh(station: Station): number | null {
  const min = resolveStationDirectPriceMinPerKwh(station)
  if (min == null) return null

  const tariff = getOperatorTariff(station.nom_operateur)
  if (!tariff) return min

  const tier = pickDirectTier(tariff, station.summary.max_power)
  if (!tier || tier.unit !== '€/kWh') return min

  if (tier.valueMax != null && tier.valueMax > tier.value) {
    return (tier.value + tier.valueMax) / 2
  }
  return min
}

function weightedPercentile(samples: PriceSample[], p: number): number | null {
  if (samples.length === 0) return null
  const sorted = [...samples].sort((a, b) => a.value - b.value)
  const total = sorted.reduce((sum, sample) => sum + sample.weight, 0)
  if (total <= 0) return null
  const target = total * p
  let cumulative = 0
  for (const sample of sorted) {
    cumulative += sample.weight
    if (cumulative >= target) return sample.value
  }
  return sorted[sorted.length - 1]?.value ?? null
}

/** Prix minimum CB direct par tronçon d'autonomie le long du trajet. */
export function computeTripSegmentMinPrices(
  routeLengthKm: number,
  stationsOnRoute: { distanceAlongRouteKm: number; station: Station }[],
  segmentLengthKm: number,
): TripSegmentPrice[] {
  const safeLength = Math.max(routeLengthKm, 1)
  const safeSegment = Math.max(segmentLengthKm, 1)
  const segmentCount = Math.max(1, Math.ceil(safeLength / safeSegment))
  const segments: TripSegmentPrice[] = []

  for (let i = 0; i < segmentCount; i += 1) {
    const startKm = i * safeSegment
    const endKm = Math.min((i + 1) * safeSegment, safeLength)
    const inSegment = stationsOnRoute.filter(
      (item) =>
        item.distanceAlongRouteKm >= startKm &&
        item.distanceAlongRouteKm <= endKm,
    )
    const prices = inSegment
      .map((item) => resolveStationDirectPriceMinPerKwh(item.station))
      .filter((price): price is number => price != null)

    segments.push({
      startKm,
      endKm,
      minPricePerKwh: prices.length > 0 ? Math.min(...prices) : null,
      pricedStationCount: prices.length,
      stationCount: inSegment.length,
    })
  }

  return segments
}

/** Estimation €/kWh CB direct pour les stations d'une zone d'arrêt. */
export function computeStopZonePriceEstimate(stations: Station[]): StopZonePriceEstimate {
  const samples: PriceSample[] = []
  const mins: number[] = []

  for (const station of stations) {
    const min = resolveStationDirectPriceMinPerKwh(station)
    const avg = resolveStationDirectPricePerKwh(station)
    if (min != null) mins.push(min)
    if (avg != null) samples.push({ value: avg, weight: station.pdc_count })
  }

  if (samples.length === 0) {
    return {
      minPricePerKwh: null,
      avgPricePerKwh: null,
      pricedStationCount: 0,
    }
  }

  const priceSum = samples.reduce((sum, sample) => sum + sample.value * sample.weight, 0)
  const totalPdc = samples.reduce((sum, sample) => sum + sample.weight, 0)

  return {
    minPricePerKwh: mins.length > 0 ? Math.min(...mins) : null,
    avgPricePerKwh: totalPdc > 0 ? priceSum / totalPdc : null,
    pricedStationCount: samples.length,
  }
}

const COMPACT_PRICE_FMT = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCompactPricePerKwh(value: number): string {
  return `${COMPACT_PRICE_FMT.format(value)}\u00a0€`
}

export function formatStopZonePriceDetailsCompact(
  minPricePerKwh: number | null,
  avgPricePerKwh: number | null,
): string | null {
  if (minPricePerKwh == null && avgPricePerKwh == null) return null

  const parts: string[] = []
  if (minPricePerKwh != null) {
    parts.push(`min ${formatCompactPricePerKwh(minPricePerKwh)}`)
  }
  if (avgPricePerKwh != null) {
    parts.push(`moy. ${formatCompactPricePerKwh(avgPricePerKwh)}`)
  }
  return `${parts.join(' · ')} €/kWh`
}

export function formatStopZonePriceDetails(
  minPricePerKwh: number | null,
  avgPricePerKwh: number | null,
): string | null {
  return formatStopZonePriceDetailsCompact(minPricePerKwh, avgPricePerKwh)
}

export function computeTripPriceSummary(stations: Station[]): TripPriceSummary {
  const samples: PriceSample[] = []
  let pricedPdcCount = 0
  let totalPdcCount = 0
  let pricedStationCount = 0

  for (const station of stations) {
    totalPdcCount += station.pdc_count
    const price = resolveStationDirectPricePerKwh(station)
    if (price == null) continue

    pricedStationCount += 1
    pricedPdcCount += station.pdc_count
    samples.push({ value: price, weight: station.pdc_count })
  }

  if (samples.length === 0) {
    return {
      avgPricePerKwh: null,
      medianPricePerKwh: null,
      minPricePerKwh: null,
      maxPricePerKwh: null,
      pricedPdcCount: 0,
      totalPdcCount,
      pricedStationCount: 0,
      totalStationCount: stations.length,
      coveragePct: 0,
    }
  }

  const priceSum = samples.reduce((sum, sample) => sum + sample.value * sample.weight, 0)
  const values = samples.map((sample) => sample.value)

  return {
    avgPricePerKwh: priceSum / pricedPdcCount,
    medianPricePerKwh: weightedPercentile(samples, 0.5),
    minPricePerKwh: Math.min(...values),
    maxPricePerKwh: Math.max(...values),
    pricedPdcCount,
    totalPdcCount,
    pricedStationCount,
    totalStationCount: stations.length,
    coveragePct: totalPdcCount > 0 ? Math.round((pricedPdcCount / totalPdcCount) * 100) : 0,
  }
}
