import { describe, expect, it } from 'vitest'
import type { Station } from '../types/irve'
import { computeStopZonePriceEstimate, computeTripPriceSummary, computeTripSegmentMinPrices, formatStopZonePriceDetails, resolveStationDirectPricePerKwh } from './tripPricing'

function station(
  operator: string,
  maxPower: number,
  pdcCount: number,
): Station {
  return {
    station_key: operator,
    id: 1,
    lat: 0,
    lng: 0,
    id_station_itinerance: operator,
    nom_station: operator,
    nom_amenageur: operator,
    nom_operateur: operator,
    condition_acces: 'Accès libre',
    accessibilite_pmr: '',
    gratuit: null,
    paiement_acte: true,
    paiement_cb: null,
    reservation: false,
    station_deux_roues: false,
    pdc_count: pdcCount,
    pdc_itinerance_ids: [],
    has_tarification: false,
    summary: {
      max_power: maxPower,
      total_power: maxPower,
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
      pdcs_with_dynamic_count: pdcCount,
      en_service_count: pdcCount,
      libre_count: 1,
      occupied_count: 0,
      reserved_count: 0,
      available_count: 1,
    },
  }
}

describe('tripPricing', () => {
  it('résout un tarif opérateur national connu', () => {
    const ionity = station('Ionity', 350, 6)
    expect(resolveStationDirectPricePerKwh(ionity)).not.toBeNull()
  })

  it('calcule une moyenne pondérée par PDC', () => {
    const priced = station('Ionity', 350, 4)
    const unknown = station('Opérateur inconnu XYZ', 150, 2)
    const summary = computeTripPriceSummary([priced, unknown])

    expect(summary.pricedPdcCount).toBe(4)
    expect(summary.totalPdcCount).toBe(6)
    expect(summary.avgPricePerKwh).not.toBeNull()
    expect(summary.coveragePct).toBe(67)
  })

  it('calcule le prix min par tronçon d’autonomie', () => {
    const segments = computeTripSegmentMinPrices(
      400,
      [
        { distanceAlongRouteKm: 50, station: station('Ionity', 350, 2) },
        { distanceAlongRouteKm: 250, station: station('TotalEnergies Marketing France', 150, 3) },
      ],
      400,
    )

    expect(segments).toHaveLength(1)
    expect(segments[0]?.minPricePerKwh).not.toBeNull()
  })

  it('estime le prix moyen pondéré par zone d arrêt', () => {
    const estimate = computeStopZonePriceEstimate([
      station('Ionity', 350, 4),
      station('TotalEnergies Marketing France', 150, 2),
    ])

    expect(estimate.avgPricePerKwh).not.toBeNull()
    expect(estimate.minPricePerKwh).not.toBeNull()
    expect(estimate.pricedStationCount).toBe(2)
    expect(formatStopZonePriceDetails(estimate.minPricePerKwh, estimate.avgPricePerKwh)).toMatch(
      /min .* · moy\..*€\/kWh$/,
    )
  })
})
