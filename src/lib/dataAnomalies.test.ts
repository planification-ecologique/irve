import { describe, expect, it } from 'vitest'
import type { Station } from '../types/irve'
import { computeDataAnomalyWarnings } from './dataAnomalies'

function station(nom_operateur: string, pdc = 1): Station {
  return {
    station_key: 'k',
    id: 1,
    lat: 0,
    lng: 0,
    id_station_itinerance: 'FR',
    nom_station: 'S',
    nom_operateur,
    nom_amenageur: 'A',
    condition_acces: '',
    accessibilite_pmr: '',
    gratuit: false,
    paiement_acte: true,
    paiement_cb: true,
    reservation: false,
    station_deux_roues: false,
    pdc_count: pdc,
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
      pricing_status: '',
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

describe('computeDataAnomalyWarnings', () => {
  it('signale les doublons nom_operateur (casse)', () => {
    const warnings = computeDataAnomalyWarnings([
      station('bp Pulse', 25),
      station('bp pulse', 1),
    ])
    const dupe = warnings.find((w) => w.id.startsWith('operator-name-dupe-'))
    expect(dupe).toBeDefined()
    expect(dupe!.stations).toBe(2)
    expect(dupe!.pdc).toBe(26)
    expect(dupe!.description).toContain('bp Pulse')
    expect(dupe!.description).toContain('bp pulse')
  })

  it('ignore les noms uniques', () => {
    const warnings = computeDataAnomalyWarnings([station('Allego')])
    expect(warnings.some((w) => w.id.startsWith('operator-name-dupe-'))).toBe(false)
  })
})
