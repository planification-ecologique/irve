import { describe, expect, it } from 'vitest'
import type { Station } from '../types/irve'
import {
  computeCoverageScore,
  coverageGradeFromScore,
  findStationsOnRoute,
  resolveStationsOnRoute,
} from './tripCoverage'
import { haversineKm, polylineLengthKm, projectPointOnPolyline } from './tripGeo'

function makeStation(
  key: string,
  lat: number,
  lng: number,
  maxPower = 150,
): Station {
  return {
    station_key: key,
    id: 1,
    lat,
    lng,
    id_station_itinerance: key,
    nom_station: `Station ${key}`,
    nom_amenageur: 'Test',
    nom_operateur: 'Test',
    condition_acces: 'Accès libre',
    accessibilite_pmr: '',
    gratuit: null,
    paiement_acte: true,
    paiement_cb: null,
    reservation: false,
    station_deux_roues: false,
    pdc_count: 2,
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
      pdcs_with_dynamic_count: 2,
      en_service_count: 2,
      libre_count: 1,
      occupied_count: 1,
      reserved_count: 0,
      available_count: 1,
    },
  }
}

describe('tripGeo', () => {
  it('calcule la distance haversine Paris–Lyon ~400 km', () => {
    const km = haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 45.764, lng: 4.8357 })
    expect(km).toBeGreaterThan(380)
    expect(km).toBeLessThan(420)
  })

  it('projette un point proche du tracé', () => {
    const route: [number, number][] = [
      [2.35, 48.85],
      [4.84, 45.76],
    ]
    const projection = projectPointOnPolyline({ lat: 48.86, lng: 2.36 }, route)
    expect(projection.distanceFromRouteKm).toBeLessThan(5)
    expect(projection.distanceAlongRouteKm).toBeGreaterThanOrEqual(0)
  })
})

describe('tripCoverage', () => {
  const route: [number, number][] = [
    [2.35, 48.85],
    [4.84, 45.76],
  ]
  const routeLengthKm = polylineLengthKm(route)

  it('filtre les bornes hors corridor ou sous puissance min', () => {
    const stations = [
      makeStation('near', 48.86, 2.36, 150),
      makeStation('far', 50, 8, 150),
      makeStation('slow', 48.861, 2.361, 22),
    ]

    const onRoute = findStationsOnRoute(stations, route, {
      corridorKm: 25,
      minPowerKw: 50,
    })

    expect(onRoute).toHaveLength(1)
    expect(onRoute[0]?.station.station_key).toBe('near')
  })

  it('score 100 % quand chaque tronçon est couvert', () => {
    const midLat = (48.85 + 45.76) / 2
    const midLng = (2.35 + 4.84) / 2
    const stationsOnRoute = [
      { station: makeStation('a', 48.86, 2.36), distanceAlongRouteKm: 50, distanceFromRouteKm: 1 },
      { station: makeStation('b', midLat, midLng), distanceAlongRouteKm: routeLengthKm / 2, distanceFromRouteKm: 1 },
      { station: makeStation('c', 45.77, 4.83), distanceAlongRouteKm: routeLengthKm - 20, distanceFromRouteKm: 1 },
    ]

    const result = computeCoverageScore(routeLengthKm, stationsOnRoute, 400)
    expect(result.score).toBe(100)
    expect(result.grade).toBe('excellent')
  })

  it('score 0 % sans borne', () => {
    const result = computeCoverageScore(800, [], 400)
    expect(result.score).toBe(0)
    expect(result.maxGapKm).toBe(800)
    expect(coverageGradeFromScore(result.score)).toBe('poor')
  })

  it('resolveStationsOnRoute with keys matches full scan', () => {
    const near = makeStation('near', 48.86, 2.36, 150)
    const far = makeStation('far', 50, 8, 150)

    const fromKeys = resolveStationsOnRoute([near, far], route, { corridorKm: 25, minPowerKw: 50 }, [
      'near',
      'far',
    ])
    const fullScan = resolveStationsOnRoute([near, far], route, { corridorKm: 25, minPowerKw: 50 })

    expect(fromKeys).toEqual(fullScan)
    expect(fromKeys).toHaveLength(1)
    expect(fromKeys[0]?.station.station_key).toBe('near')
  })
})
