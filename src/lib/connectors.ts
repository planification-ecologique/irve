import type { StationSummary, ConnectorType } from '../types/irve'

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

export function stationHasConnector(
  summary: StationSummary,
  connector: ConnectorType,
): boolean {
  return Boolean(summary[CONNECTOR_META[connector].field])
}
