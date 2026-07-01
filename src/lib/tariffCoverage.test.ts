import { describe, expect, it } from 'vitest'
import type { Station } from '../types/irve'
import {
  computeOperatorTariffCoverage,
  computeTariffCoverageSummary,
  computeTariffFicheCoverageByTariff,
  formatTariffCoveragePercent,
} from './tariffCoverage'

function station(partial: Partial<Station> & Pick<Station, 'nom_operateur' | 'summary'>): Station {
  return {
    station_key: 'k',
    id: 1,
    lat: 0,
    lng: 0,
    id_station_itinerance: 'FR',
    nom_station: 'S',
    nom_amenageur: 'A',
    condition_acces: '',
    accessibilite_pmr: '',
    gratuit: false,
    paiement_acte: true,
    paiement_cb: true,
    reservation: false,
    station_deux_roues: false,
    pdc_count: partial.pdc_count ?? 2,
    pdc_itinerance_ids: [],
    has_tarification: false,
    dynamic_summary: {
      pdcs_with_dynamic_count: 0,
      en_service_count: 0,
      libre_count: 0,
      occupied_count: 0,
      reserved_count: 0,
      available_count: 0,
    },
    ...partial,
  } as Station
}

const baseSummary = {
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
} as const

describe('computeTariffCoverageSummary', () => {
  it('répartit QualiCharge, éditorial et affichable', () => {
    const stations = [
      station({
        nom_operateur: 'Lidl France',
        pdc_count: 5,
        summary: { ...baseSummary, price_per_kwh: 0.29 },
      }),
      station({
        nom_operateur: 'NW IECharge',
        pdc_count: 3,
        summary: baseSummary,
      }),
      station({
        nom_operateur: 'DRIVECO',
        pdc_count: 4,
        summary: baseSummary,
      }),
    ]

    const summary = computeTariffCoverageSummary(stations)
    expect(summary.qualicharge).toEqual({ stations: 1, pdc: 5 })
    expect(summary.editorial).toEqual({ stations: 1, pdc: 3 })
    expect(summary.displayable).toEqual({ stations: 2, pdc: 8 })
    expect(summary.totalStations).toBe(3)
    expect(summary.totalPdc).toBe(12)
  })
})

describe('computeOperatorTariffCoverage', () => {
  it('agrège par nom_operateur', () => {
    const stations = [
      station({
        nom_operateur: 'Lidl France',
        pdc_count: 5,
        summary: { ...baseSummary, price_per_kwh: 0.29 },
      }),
      station({
        nom_operateur: 'DRIVECO',
        pdc_count: 2,
        summary: baseSummary,
      }),
    ]

    const rows = computeOperatorTariffCoverage(stations)
    expect(rows).toHaveLength(2)
    const lidl = rows.find((row) => row.operator === 'Lidl France')
    expect(lidl).toMatchObject({
      operator: 'Lidl France',
      totalStations: 1,
      totalPdc: 5,
      qualichargeStations: 1,
      qualichargePdc: 5,
      displayableStations: 1,
      displayablePdc: 5,
    })
  })
})

describe('computeTariffFicheCoverageByTariff', () => {
  it('agrège QualiCharge et affichable par fiche', () => {
    const stations = [
      {
        nom_operateur: 'Lidl France',
        pdc_count: 5,
        summary: { price_per_kwh: 0.29 },
      },
      {
        nom_operateur: 'NW IECharge',
        pdc_count: 3,
        summary: {},
      },
    ] as Station[]

    const map = computeTariffFicheCoverageByTariff(stations, [
      { id: 'lidl', match: ['Lidl France'] },
      { id: 'iecharge', match: ['NW IECharge'] },
    ])

    expect(map.get('lidl')).toEqual({
      totalPdc: 5,
      qualichargePdc: 5,
      displayablePdc: 5,
    })
    expect(map.get('iecharge')).toEqual({
      totalPdc: 3,
      qualichargePdc: 0,
      displayablePdc: 3,
    })
  })
})

describe('formatTariffCoveragePercent', () => {
  it('arrondit ou garde une décimale', () => {
    expect(formatTariffCoveragePercent(34, 100)).toBe('34 %')
    expect(formatTariffCoveragePercent(1, 12)).toBe('8,3 %')
  })
})
