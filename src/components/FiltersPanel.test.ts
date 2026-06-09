import { describe, expect, it } from 'vitest'
import { defaultFilters, filterStations } from './FiltersPanel'
import type { Station } from '../types/irve'

function station(overrides: Partial<Station['summary']> & { station_key?: string }): Station {
  const { station_key = 'test', ...summaryOverrides } = overrides
  return {
    station_key,
    id: 1,
    lat: 48.8,
    lng: 2.3,
    id_station_itinerance: station_key,
    nom_station: 'Test',
    nom_amenageur: 'Amenageur',
    nom_operateur: 'Operateur',
    condition_acces: 'Accès libre',
    accessibilite_pmr: 'Accessible',
    gratuit: null,
    paiement_acte: true,
    paiement_cb: null,
    reservation: false,
    station_deux_roues: false,
    pdc_count: 1,
    pdc_itinerance_ids: [],
    has_tarification: false,
    summary: {
      max_power: 50,
      total_power: 50,
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
      ...summaryOverrides,
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

describe('filterStations', () => {
  it('excludes CHAdeMO-only live stations from the fast map', () => {
    const stations = [
      station({ station_key: 'ccs', has_prise_type_combo_ccs: true }),
      station({
        station_key: 'cha-only',
        has_prise_type_combo_ccs: false,
        has_prise_type_chademo: true,
      }),
    ]

    const filtered = filterStations(stations, defaultFilters, false)
    expect(filtered.map((s) => s.station_key)).toEqual(['ccs'])
  })

  it('keeps dual-stack CHAdeMO + CCS stations', () => {
    const stations = [
      station({
        station_key: 'dual',
        has_prise_type_combo_ccs: true,
        has_prise_type_chademo: true,
      }),
    ]

    const filtered = filterStations(stations, defaultFilters, false)
    expect(filtered.map((s) => s.station_key)).toEqual(['dual'])
  })
})
