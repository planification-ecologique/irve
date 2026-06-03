import { describe, expect, it } from 'vitest'
import type { Station } from '../types/irve'
import {
  activeTariffPowerRangesForStations,
  computeTariffRangeBoxPlots,
  computeWeightedTariffAverages,
  tariffBoxPlotScale,
  TARIFF_BOX_PLOT_SCALE_MIN,
} from './tariffPowerRanges'

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

describe('activeTariffPowerRangesForStations', () => {
  it('masque les paliers sans station', () => {
    const ranges = activeTariffPowerRangesForStations([
      station({
        nom_operateur: 'NW IECharge',
        summary: { max_power: 180, total_power: 180 } as Station['summary'],
      }),
    ])
    expect(ranges.map((r) => r.id)).toEqual(['hpc'])
    expect(ranges.some((r) => r.id === 'ac')).toBe(false)
  })
})

describe('tariffBoxPlotScale', () => {
  it('démarre à 0,25 €/kWh', () => {
    const plots = computeTariffRangeBoxPlots([
      station({
        nom_operateur: 'NW IECharge',
        summary: { max_power: 180, total_power: 180 } as Station['summary'],
      }),
    ])
    const scale = tariffBoxPlotScale(plots)
    expect(scale.min).toBe(TARIFF_BOX_PLOT_SCALE_MIN)
    expect(scale.max).toBeGreaterThan(scale.min)
  })
})

describe('computeTariffRangeBoxPlots', () => {
  it('calcule médiane pondérée', () => {
    const stations = [
      station({
        nom_operateur: 'NW IECharge',
        pdc_count: 9,
        summary: { max_power: 180, total_power: 180 } as Station['summary'],
      }),
      station({
        nom_operateur: 'Lidl France',
        pdc_count: 1,
        summary: { max_power: 180, total_power: 180 } as Station['summary'],
      }),
    ]
    const hpc = computeTariffRangeBoxPlots(stations).find((r) => r.rangeId === 'hpc')
    expect(hpc?.median).toBe(0.25)
    expect(hpc?.pricedPdcCount).toBe(10)
  })
})

describe('computeWeightedTariffAverages', () => {
  it('pondère par pdc_count', () => {
    const stations = [
      station({
        nom_operateur: 'NW IECharge',
        pdc_count: 10,
        summary: { max_power: 180, total_power: 180 } as Station['summary'],
      }),
      station({
        nom_operateur: 'Lidl France',
        pdc_count: 2,
        summary: { max_power: 22, total_power: 22 } as Station['summary'],
      }),
    ]
    const hpc = computeWeightedTariffAverages(stations).find((r) => r.rangeId === 'hpc')
    const ac = computeWeightedTariffAverages(stations).find((r) => r.rangeId === 'ac')
    expect(hpc?.avgPrice).toBeCloseTo(0.25, 2)
    expect(hpc?.pdcCount).toBe(10)
    expect(ac?.avgPrice).toBeCloseTo(0.29, 2)
    expect(ac?.pdcCount).toBe(2)
  })
})
