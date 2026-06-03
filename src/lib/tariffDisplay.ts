import type {
  OperatorTariff,
  PricingModel,
  TariffConfidence,
  TariffTier,
  TariffUnit,
} from '../data/operatorTariffs'
import {
  getOperatorDirectPriceForRange,
  type TariffPowerRange,
} from './tariffPowerRanges'

export type TariffTableSortDir = 'asc' | 'desc'
export type TariffTableSortKey = 'label' | 'model' | `range:${string}`

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

export function tariffHasDisplayablePrice(tariff: OperatorTariff): boolean {
  return (
    (tariff.pricingModel === 'national-fixed' || tariff.pricingModel === 'regional-fixed') &&
    tariff.tiers.some((t) => t.access === 'direct')
  )
}

export function compareTariffs(a: OperatorTariff, b: OperatorTariff): number {
  const modelOrder: Record<PricingModel, number> = {
    'national-fixed': 0,
    'regional-fixed': 1,
    'varies-by-site': 2,
    unknown: 3,
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
  'regional-fixed': 1,
  'varies-by-site': 2,
  unknown: 3,
}

/** Tri tableau tarifs (opérateur, palier, modèle). Sans prix → fin de liste. */
export function compareTariffsForTableSort(
  a: OperatorTariff,
  b: OperatorTariff,
  sortKey: TariffTableSortKey,
  direction: TariffTableSortDir,
  rangesById: ReadonlyMap<string, TariffPowerRange>,
): number {
  const mul = direction === 'asc' ? 1 : -1

  if (sortKey === 'label') {
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
    column === 'label' || column === 'model' ? 'asc' : 'asc'
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
