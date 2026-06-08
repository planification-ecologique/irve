import { describe, expect, it } from 'vitest'
import {
  getOperatorOptionsWithCounts,
  getOperatorRequiredNote,
  stationMatchesOperator,
} from './operators'
import type { Station } from '../types/irve'

function station(nom_operateur: string): Station {
  return {
    station_key: nom_operateur,
    id: 1,
    lat: 0,
    lng: 0,
    id_station_itinerance: nom_operateur,
    nom_station: 'S',
    nom_amenageur: 'A',
    nom_operateur,
    condition_acces: '',
    accessibilite_pmr: '',
    gratuit: null,
    paiement_acte: true,
    paiement_cb: null,
    reservation: false,
    station_deux_roues: false,
    pdc_count: 1,
    pdc_itinerance_ids: [],
    has_tarification: false,
    summary: {
      max_power: 150,
      total_power: 150,
      has_prise_type_ef: false,
      has_prise_type_2: false,
      has_prise_type_combo_ccs: true,
      has_prise_type_chademo: false,
      has_prise_type_autre: false,
      price_per_kwh: null,
      pricing_value: null,
      pricing_dimension: null,
      pricing_unit: null,
      pricing_status: 'UNKNOWN',
      pricing_headline: null,
      applicable_tariff_count: 0,
    },
    dynamic_summary: {
      pdcs_with_dynamic_count: 0,
      en_service_count: 0,
      libre_count: 0,
      occupied_count: 0,
      reserved_count: 0,
      available_count: 0,
    },
  }
}

describe('getOperatorOptionsWithCounts', () => {
  it('lists every operator present in the dataset', () => {
    const options = getOperatorOptionsWithCounts([
      station('Power Dot France'),
      station('Bouygues Energies & Services'),
    ])

    expect(options).toHaveLength(2)
    expect(options.map((o) => o.label).sort()).toEqual(['Bouygues Energies & Services', 'Powerdot'])
  })

  it('groups TotalEnergies variants and bp pulse casings', () => {
    const options = getOperatorOptionsWithCounts([
      station('TotalEnergies Marketing France'),
      station('TotalEnergies Charging Services'),
      station('bp Pulse'),
      station('bp pulse'),
    ])

    const total = options.find((o) => o.label === 'TotalEnergies')
    const bp = options.find((o) => o.label === 'bp pulse')

    expect(options).toHaveLength(2)
    expect(total?.count).toBe(2)
    expect(bp?.count).toBe(2)
  })
})

describe('stationMatchesOperator', () => {
  it('matches grouped operators via canonical id', () => {
    const s = station('TotalEnergies Charging Services')
    expect(stationMatchesOperator(s, 'TotalEnergies Marketing France')).toBe(true)
  })

  it('matches unprofiled operators by exact nom_operateur', () => {
    const s = station('Bouygues Energies & Services')
    expect(stationMatchesOperator(s, 'Bouygues Energies & Services')).toBe(true)
    expect(stationMatchesOperator(s, 'Power Dot France')).toBe(false)
  })
})

describe('getOperatorRequiredNote', () => {
  it('returns access notes for profiled operators', () => {
    expect(getOperatorRequiredNote('Tesla')).toContain('Tesla')
    expect(getOperatorRequiredNote('Bouygues Energies & Services')).toBeUndefined()
  })
})
