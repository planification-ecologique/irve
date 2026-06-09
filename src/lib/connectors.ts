import type { StationSummary, ConnectorType } from '../types/irve'

/** Puissance max réaliste sur une prise Type 2 AC (triphasé). */
export const TYPE2_MAX_POWER_KW = 43

export const CONNECTOR_META: Record<
  ConnectorType,
  { label: string; shortLabel: string; field: keyof StationSummary }
> = {
  ccs: { label: 'Combo CCS', shortLabel: 'CCS', field: 'has_prise_type_combo_ccs' },
  type2: { label: 'Type 2', shortLabel: 'T2', field: 'has_prise_type_2' },
  chademo: { label: 'CHAdeMO', shortLabel: 'CHA', field: 'has_prise_type_chademo' },
  ef: { label: 'Prise EF', shortLabel: 'EF', field: 'has_prise_type_ef' },
}

export const CONNECTOR_TYPES: ConnectorType[] = ['ccs', 'type2', 'chademo', 'ef']

/** Certains opérateurs (ex. Izivia) taguent le DC en T2 sans flag CCS. */
export function isMisTaggedDcOnly(summary: StationSummary): boolean {
  return (
    summary.max_power > TYPE2_MAX_POWER_KW &&
    summary.has_prise_type_2 &&
    !summary.has_prise_type_combo_ccs &&
    !summary.has_prise_type_chademo
  )
}

export function stationHasEffectiveCcs(summary: StationSummary): boolean {
  if (summary.has_prise_type_combo_ccs) return true
  // DC ≥50 kW sans CHAdeMO, flag CCS absent → inférer Combo CCS
  if (summary.max_power >= 50 && !summary.has_prise_type_chademo && isMisTaggedDcOnly(summary)) {
    return true
  }
  return false
}

/** CHAdeMO sans Combo CCS effectif — legacy, masqué par défaut sur la carto rapide. */
export function isChademoOnlyWithoutCcs(summary: StationSummary): boolean {
  return summary.has_prise_type_chademo && !stationHasEffectiveCcs(summary)
}

function hasType2(summary: StationSummary, minPower: number): boolean {
  if (!summary.has_prise_type_2) return false
  if (minPower > TYPE2_MAX_POWER_KW) return false
  if (isMisTaggedDcOnly(summary)) return false
  return true
}

export function stationHasConnector(
  summary: StationSummary,
  connector: ConnectorType,
  minPower = 0,
): boolean {
  switch (connector) {
    case 'ccs':
      return stationHasEffectiveCcs(summary)
    case 'type2':
      return hasType2(summary, minPower)
    case 'chademo':
      return summary.has_prise_type_chademo
    case 'ef':
      return summary.has_prise_type_ef
  }
}
