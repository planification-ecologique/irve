import type { Station } from '../types/irve'

interface OperatorProfile {
  label: string
  match: readonly string[]
  /** Uniquement si recharge impossible sans badge/app propre. */
  requiredAccessNote?: string
}

/**
 * Overrides affichage + regroupement variantes `nom_operateur`.
 * Opérateurs absents ici : label = valeur brute QualiCharge.
 */
const OPERATOR_PROFILES: readonly OperatorProfile[] = [
  { label: 'Allego', match: ['Allego'] },
  { label: 'Atlante', match: ['Atlante France'] },
  { label: 'bp pulse', match: ['bp Pulse', 'bp pulse'] },
  { label: 'Bump', match: ['Bump'] },
  { label: 'Citeos', match: ['Citeos Mobilité Electrique Paris - Cogelum IDF'] },
  { label: 'Dream Energy', match: ['DREAM ENERGY'] },
  { label: 'Driveco', match: ['DRIVECO'] },
  { label: 'E-Totem', match: ['E-Totem'] },
  { label: 'Electra', match: ['Electra'] },
  { label: 'Engie Vianeo', match: ['ENGIE Vianeo'] },
  { label: 'EVzen', match: ['EVzen'] },
  { label: 'Fastned', match: ['Fastned France'] },
  { label: 'Freshmile', match: ['Freshmile'] },
  {
    label: 'Ionity',
    match: ['Ionity'],
    requiredAccessNote: 'Pas de CB — app Ionity ou badge compatible requis',
  },
  { label: 'Izivia', match: ['IZIVIA'] },
  { label: 'Lidl', match: ['Lidl France'] },
  { label: 'NW IECharge', match: ['NW IECharge'] },
  { label: 'Plenitude On The Road', match: ['Plenitude On The Road'] },
  { label: 'Plug Inn', match: ['Plug Inn fast charge'] },
  { label: 'Powerdot', match: ['Power Dot France'] },
  { label: 'R3', match: ['R3'] },
  { label: 'Shell Recharge', match: ['Shell Recharge'] },
  {
    label: 'Tesla',
    match: ['Tesla'],
    requiredAccessNote: 'Compte Tesla requis',
  },
  {
    label: 'TotalEnergies',
    match: ['TotalEnergies Marketing France', 'TotalEnergies Charging Services'],
  },
  {
    label: 'Mercedes easy charge',
    match: ['EASYCHARGE'],
    requiredAccessNote: 'Carte Mercedes me Charge requise',
  },
]

const profileByNomOperateur = new Map<string, OperatorProfile>()
const profileByCanonicalId = new Map<string, OperatorProfile>()

for (const profile of OPERATOR_PROFILES) {
  profileByCanonicalId.set(profile.match[0], profile)
  for (const nom of profile.match) {
    profileByNomOperateur.set(nom, profile)
  }
}

function resolveOperator(nomOperateur: string): { id: string; profile: OperatorProfile } {
  const profile = profileByNomOperateur.get(nomOperateur)
  if (profile) {
    return { id: profile.match[0], profile }
  }

  return {
    id: nomOperateur,
    profile: { label: nomOperateur, match: [nomOperateur] },
  }
}

export interface OperatorOption {
  id: string
  label: string
  match: readonly string[]
  requiredAccessNote?: string
}

export interface OperatorOptionWithCount extends OperatorOption {
  count: number
}

export function getOperatorOptionsWithCounts(stations: Station[]): OperatorOptionWithCount[] {
  const buckets = new Map<string, OperatorOptionWithCount>()

  for (const station of stations) {
    const nom = station.nom_operateur?.trim()
    if (!nom) continue

    const { id, profile } = resolveOperator(nom)
    const existing = buckets.get(id)

    if (existing) {
      existing.count += 1
      continue
    }

    buckets.set(id, {
      id,
      label: profile.label,
      match: profile.match,
      requiredAccessNote: profile.requiredAccessNote,
      count: 1,
    })
  }

  return [...buckets.values()]
    .filter((option) => option.count > 0)
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
}

export function getOperatorRequiredNote(operatorId: string): string | undefined {
  return profileByCanonicalId.get(operatorId)?.requiredAccessNote
}

export function stationMatchesOperator(station: Station, operatorId: string | null): boolean {
  if (!operatorId) return true

  const profile = profileByCanonicalId.get(operatorId)
  if (profile) {
    return profile.match.includes(station.nom_operateur)
  }

  return station.nom_operateur === operatorId
}
