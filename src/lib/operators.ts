import type { Station } from '../types/irve'

export interface OperatorOption {
  id: string
  label: string
  match: readonly string[]
  /** Uniquement si recharge impossible sans badge/app propre. */
  requiredAccessNote?: string
}

export const OPERATOR_OPTIONS: OperatorOption[] = [
  { id: 'allego', label: 'Allego', match: ['Allego'] },
  { id: 'izivia', label: 'Izivia', match: ['IZIVIA'] },
  {
    id: 'ionity',
    label: 'Ionity',
    match: ['Ionity'],
    requiredAccessNote: 'Pas de CB — app Ionity ou badge compatible requis',
  },
  {
    id: 'tesla',
    label: 'Tesla',
    match: ['Tesla'],
    requiredAccessNote: 'Compte Tesla requis',
  },
  {
    id: 'totalenergies',
    label: 'TotalEnergies',
    match: ['TotalEnergies Marketing France', 'TotalEnergies Charging Services'],
  },
  { id: 'electra', label: 'Electra', match: ['Electra'] },
  { id: 'fastned', label: 'Fastned', match: ['Fastned France'] },
  { id: 'shell', label: 'Shell Recharge', match: ['Shell Recharge'] },
  { id: 'bp-pulse', label: 'bp pulse', match: ['bp Pulse'] },
  { id: 'evzen', label: 'EVzen', match: ['EVzen'] },
  { id: 'driveco', label: 'Driveco', match: ['DRIVECO'] },
  { id: 'engie-vianeo', label: 'Engie Vianeo', match: ['ENGIE Vianeo'] },
  { id: 'e-totem', label: 'E-Totem', match: ['E-Totem'] },
  { id: 'atlante', label: 'Atlante', match: ['Atlante France'] },
  { id: 'freshmile', label: 'Freshmile', match: ['Freshmile'] },
  { id: 'bump', label: 'Bump', match: ['Bump'] },
  { id: 'plenitude', label: 'Plenitude On The Road', match: ['Plenitude On The Road'] },
  {
    id: 'easycharge',
    label: 'Mercedes easy charge',
    match: ['EASYCHARGE'],
    requiredAccessNote: 'Carte Mercedes me Charge requise',
  },
]

const operatorMatchSet = new Map(
  OPERATOR_OPTIONS.map((option) => [option.id, new Set(option.match)]),
)

const operatorById = new Map(OPERATOR_OPTIONS.map((option) => [option.id, option]))

export interface OperatorOptionWithCount extends OperatorOption {
  count: number
}

export function getOperatorOptionsWithCounts(stations: Station[]): OperatorOptionWithCount[] {
  return OPERATOR_OPTIONS.map((option) => ({
    ...option,
    count: stations.filter((station) =>
      operatorMatchSet.get(option.id)?.has(station.nom_operateur),
    ).length,
  }))
    .filter((option) => option.count > 0)
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
}

export function getOperatorRequiredNote(operatorId: string): string | undefined {
  return operatorById.get(operatorId)?.requiredAccessNote
}

export function stationMatchesOperator(station: Station, operatorId: string | null): boolean {
  if (!operatorId) return true

  const matches = operatorMatchSet.get(operatorId)
  return matches?.has(station.nom_operateur) ?? false
}
