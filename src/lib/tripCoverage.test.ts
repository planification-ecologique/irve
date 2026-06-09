import { describe, expect, it } from 'vitest'
import type { Station } from '../types/irve'
import {
  computeCoverageScore,
  computeTripChargeStops,
  tripChargeStopCount,
  coverageGradeFromScore,
  findStationsOnRoute,
  resolveStationsOnRoute,
} from './tripCoverage'
import { haversineKm, interpolateRoutePointAtKm, polylineLengthKm, projectPointOnPolyline } from './tripGeo'

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

  it('interpole un point le long du tracé à km donné', () => {
    const route: [number, number][] = [
      [2.35, 48.85],
      [4.84, 45.76],
    ]
    const total = polylineLengthKm(route)
    const start = interpolateRoutePointAtKm(route, 0)
    const mid = interpolateRoutePointAtKm(route, total / 2)
    const end = interpolateRoutePointAtKm(route, total)

    expect(start).toEqual(route[0])
    expect(end).toEqual(route[route.length - 1])
    expect(mid).not.toBeNull()
    expect(haversineKm(
      { lat: start![1], lng: start![0] },
      { lat: mid![1], lng: mid![0] },
    )).toBeGreaterThan(total * 0.4)
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

  it('repère les arrêts recharge rapide (hors arrivée)', () => {
    const stationsOnRoute = [
      {
        station: makeStation('early', 48.86, 2.36, 150),
        distanceAlongRouteKm: 320,
        distanceFromRouteKm: 1,
      },
      {
        station: makeStation('hub', 47.5, 3.5, 150),
        distanceAlongRouteKm: 360,
        distanceFromRouteKm: 1,
      },
      {
        station: makeStation('late', 45.77, 4.83),
        distanceAlongRouteKm: 560,
        distanceFromRouteKm: 1,
      },
    ]

    expect(tripChargeStopCount(580, 400)).toBe(1)
    expect(tripChargeStopCount(800, 400)).toBe(2)
    expect(tripChargeStopCount(350, 400)).toBe(0)

    const stops = computeTripChargeStops(580, stationsOnRoute, 400)

    expect(stops).toHaveLength(1)
    expect(stops[0]?.covered).toBe(true)
    expect(stops[0]?.likelyStop?.centerKm).toBeGreaterThan(300)
    expect(stops[0]?.likelyStop?.centerKm).toBeLessThan(400)
  })
})
