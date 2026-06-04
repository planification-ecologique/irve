import {
  getOperatorTariff,
  getStationOperatorTariffHeadline,
  pickDirectTier,
  type OperatorTariff,
  type PricingModel,
  type TariffConfidence,
  type TariffTier,
  type TariffUnit,
} from '../data/operatorTariffs'
import type { Station } from '../types/irve'
import {
  getOperatorDirectPriceForRange,
  type TariffPowerRange,
} from './tariffPowerRanges'

export type TariffTableSortDir = 'asc' | 'desc'
export type TariffTableSortKey = 'label' | 'stations' | 'model' | `range:${string}`

const PRICE_FMT = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
})

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  'national-fixed': 'Tarif national fixe',
  'national-range': 'Fourchette nationale',
  'regional-fixed': 'Tarif régional fixe',
  'varies-by-site': 'Prix par station',
  unknown: 'Grille non publiée',
}

export const CONFIDENCE_LABELS: Record<TariffConfidence, string> = {
  high: 'Élevée',
  medium: 'Moyenne',
  low: 'Faible',
}

export function formatTariffPrice(value: number, unit: TariffUnit): string {
  return `${PRICE_FMT.format(value)}\u00a0${unit}`
}

/** Prix unique ou fourchette min–max (€/kWh). */
export function formatTariffTierPrice(tier: TariffTier): string {
  if (
    tier.valueMax != null &&
    tier.valueMax > tier.value &&
    tier.unit === '€/kWh'
  ) {
    return `${PRICE_FMT.format(tier.value)} – ${PRICE_FMT.format(tier.valueMax)}\u00a0${tier.unit}`
  }
  return formatTariffPrice(tier.value, tier.unit)
}

export function formatEuro(amount: number): string {
  return `${PRICE_FMT.format(amount)}\u00a0€`
}

export function formatTariffDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : DATE_FMT.format(d)
}

export function formatPowerRange(tier: TariffTier): string {
  const { powerMinKw: min, powerMaxKw: max } = tier
  if (min == null && max == null) return 'Toutes puissances'
  if (min == null) return `≤ ${max} kW`
  if (max == null) return `≥ ${min} kW`
  if (min === max) return `${min} kW`
  return `${min}–${max} kW`
}

export function formatDirectCb(value: boolean | null): string {
  if (value === true) return 'Oui'
  if (value === false) return 'Non'
  return '—'
}

export type StationTariffDataQuality = 'reliable' | 'approximate' | 'missing'

export const STATION_TARIFF_QUALITY_LABELS: Record<StationTariffDataQuality, string> = {
  reliable: 'Données fiables',
  approximate: 'Données approximatives',
  missing: 'Données manquantes',
}

/** Qualité tarifaire d’une station selon la fiche opérateur jointe. */
export function classifyStationTariffQuality(
  nomOperateur: string | null | undefined,
): StationTariffDataQuality {
  const tariff = getOperatorTariff(nomOperateur)
  if (!tariff || !tariffHasDisplayablePrice(tariff)) return 'missing'
  if (
    tariff.pricingModel === 'national-range' ||
    tariff.confidence === 'medium' ||
    tariff.confidence === 'low'
  ) {
    return 'approximate'
  }
  return 'reliable'
}

export interface StationTariffQualityBreakdown {
  reliable: number
  approximate: number
  missing: number
  total: number
}

export function computeStationTariffQualityBreakdown(
  stations: readonly Station[],
): StationTariffQualityBreakdown {
  let reliable = 0
  let approximate = 0
  let missing = 0
  for (const station of stations) {
    const quality = classifyStationTariffQuality(station.nom_operateur)
    if (quality === 'reliable') reliable += 1
    else if (quality === 'approximate') approximate += 1
    else missing += 1
  }
  return { reliable, approximate, missing, total: stations.length }
}

export function tariffHasDisplayablePrice(tariff: OperatorTariff): boolean {
  return (
    (tariff.pricingModel === 'national-fixed' ||
      tariff.pricingModel === 'national-range' ||
      tariff.pricingModel === 'regional-fixed') &&
    tariff.tiers.some((t) => t.access === 'direct')
  )
}

/** Bornes du curseur « prix max » (€/kWh, accès direct). */
export const PRICE_FILTER_MIN_KWH = 0.2
export const PRICE_FILTER_MAX_KWH = 0.7
export const PRICE_FILTER_STEP_KWH = 0.01

/** Plafond par défaut = pas de filtre prix max actif. */
export const PRICE_FILTER_DEFAULT_MAX_KWH = PRICE_FILTER_MAX_KWH

export function isPriceMaxFilterActive(maxPricePerKwh: number): boolean {
  return maxPricePerKwh < PRICE_FILTER_DEFAULT_MAX_KWH - PRICE_FILTER_STEP_KWH / 2
}

export function formatFilterPricePerKwh(value: number): string {
  return PRICE_FMT.format(value)
}

/** Borne basse / haute €/kWh comparables (fourchette → max = tier.valueMax). */
export function getStationPricePerKwhBounds(station: Station): { min: number; max: number } | null {
  const { summary } = station

  if (summary.price_per_kwh != null) {
    return { min: summary.price_per_kwh, max: summary.price_per_kwh }
  }

  if (summary.pricing_value != null) {
    const unit = summary.pricing_unit?.toLowerCase() ?? ''
    if (unit.includes('kwh')) {
      return { min: summary.pricing_value, max: summary.pricing_value }
    }
  }

  const tariff = getOperatorTariff(station.nom_operateur)
  if (!tariff) return null
  if (
    tariff.pricingModel !== 'national-fixed' &&
    tariff.pricingModel !== 'national-range' &&
    tariff.pricingModel !== 'regional-fixed'
  ) {
    return null
  }

  const tier = pickDirectTier(tariff, summary.max_power ?? null)
  if (!tier || tier.unit !== '€/kWh') return null

  return { min: tier.value, max: tier.valueMax ?? tier.value }
}

/** Prix QualiCharge ou tarif opérateur affichable (même logique que fiche station). */
export function stationHasAvailablePrice(station: Station): boolean {
  const { summary } = station
  if (summary.pricing_headline) return true
  if (summary.price_per_kwh != null) return true
  if (summary.pricing_value != null) return true
  return getStationOperatorTariffHeadline(station) != null
}

/** Passe si le tarif direct documenté est ≤ plafond (fourchette : borne haute). */
export function stationMatchesMaxPriceFilter(station: Station, maxPricePerKwh: number): boolean {
  const bounds = getStationPricePerKwhBounds(station)
  if (!bounds) return false
  return bounds.max <= maxPricePerKwh + 1e-9
}

export function compareTariffs(a: OperatorTariff, b: OperatorTariff): number {
  const modelOrder: Record<PricingModel, number> = {
    'national-fixed': 0,
    'national-range': 1,
    'regional-fixed': 2,
    'varies-by-site': 3,
    unknown: 4,
  }
  const byModel = modelOrder[a.pricingModel] - modelOrder[b.pricingModel]
  if (byModel !== 0) return byModel
  return a.label.localeCompare(b.label, 'fr')
}

/** Meilleur palier €/kWh « accès direct » (CB / sans abonnement). */
export function getBestDirectKwhPrice(tariff: OperatorTariff): {
  tier: TariffTier
  value: number
} | null {
  const direct = tariff.tiers.filter((t) => t.access === 'direct' && t.unit === '€/kWh')
  if (direct.length === 0) return null
  const tier = direct.reduce((best, t) => (t.value < best.value ? t : best))
  return { tier, value: tier.value }
}

/** Coût mensuel indicatif (€) = km × conso/100 × €/kWh — hors abonnement. */
export function estimateMonthlyChargeEur(
  kmPerMonth: number,
  kWhPer100km: number,
  pricePerKwh: number,
): number {
  const kWh = (kmPerMonth * kWhPer100km) / 100
  return kWh * pricePerKwh
}

/** Classement type La Chaine EV : du moins cher au plus cher (prix direct min). */
export function compareTariffsByBestDirectPrice(a: OperatorTariff, b: OperatorTariff): number {
  const pa = getBestDirectKwhPrice(a)?.value ?? Number.POSITIVE_INFINITY
  const pb = getBestDirectKwhPrice(b)?.value ?? Number.POSITIVE_INFINITY
  if (pa !== pb) return pa - pb
  return a.label.localeCompare(b.label, 'fr')
}

const MODEL_SORT_ORDER: Record<PricingModel, number> = {
  'national-fixed': 0,
  'national-range': 1,
  'regional-fixed': 2,
  'varies-by-site': 3,
  unknown: 4,
}

/** Tri tableau tarifs (opérateur, palier, modèle). Sans prix → fin de liste. */
export function compareTariffsForTableSort(
  a: OperatorTariff,
  b: OperatorTariff,
  sortKey: TariffTableSortKey,
  direction: TariffTableSortDir,
  rangesById: ReadonlyMap<string, TariffPowerRange>,
  stationCounts?: ReadonlyMap<string, number>,
): number {
  const mul = direction === 'asc' ? 1 : -1

  if (sortKey === 'label') {
    return mul * a.label.localeCompare(b.label, 'fr')
  }

  if (sortKey === 'stations') {
    const ca = stationCounts?.get(a.id) ?? 0
    const cb = stationCounts?.get(b.id) ?? 0
    if (ca !== cb) return mul * (ca - cb)
    return mul * a.label.localeCompare(b.label, 'fr')
  }

  if (sortKey === 'model') {
    const byModel = MODEL_SORT_ORDER[a.pricingModel] - MODEL_SORT_ORDER[b.pricingModel]
    if (byModel !== 0) return mul * byModel
    return mul * a.label.localeCompare(b.label, 'fr')
  }

  if (sortKey.startsWith('range:')) {
    const rangeId = sortKey.slice('range:'.length)
    const range = rangesById.get(rangeId)
    const pa =
      range != null ? (getOperatorDirectPriceForRange(a, range) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY
    const pb =
      range != null ? (getOperatorDirectPriceForRange(b, range) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY
    if (pa !== pb) return mul * (pa - pb)
    return mul * a.label.localeCompare(b.label, 'fr')
  }

  return mul * a.label.localeCompare(b.label, 'fr')
}

export function nextTariffTableSort(
  currentKey: TariffTableSortKey,
  currentDir: TariffTableSortDir,
  column: TariffTableSortKey,
): { key: TariffTableSortKey; dir: TariffTableSortDir } {
  if (currentKey === column) {
    return { key: column, dir: currentDir === 'asc' ? 'desc' : 'asc' }
  }
  const defaultDir: TariffTableSortDir =
    column === 'stations' ? 'desc' : column === 'label' || column === 'model' ? 'asc' : 'asc'
  return { key: column, dir: defaultDir }
}

export function tariffTableSortIndicator(
  column: TariffTableSortKey,
  activeKey: TariffTableSortKey,
  direction: TariffTableSortDir,
): string {
  if (column !== activeKey) return ''
  return direction === 'asc' ? ' ↑' : ' ↓'
}
