import { describe, expect, it } from 'vitest'
import type { Station } from '../types/irve'
import {
  buildSvgLinePathsWithGaps,
  computeRollingRouteDensity,
  computeRouteDensityBins,
  computeRouteGapBands,
  computeSparseRouteBands,
  MAX_DENSITY_BIN_SCALE,
  routeDensityBinSizeKm,
  routeDensityScaleMax,
  routeDensityTicks,
  routeGapWarningKm,
  routePriceScale,
  rollingWindowKm,
  sumRoutePdc,
} from './tripRouteDensity'
import type { StationOnRoute } from './tripCoverage'

function stationAt(km: number, pdcCount = 2): StationOnRoute {
  return {
    station: {
      station_key: `s-${km}`,
      pdc_count: pdcCount,
      dynamic_summary: { available_count: 1 },
    } as Station,
    distanceAlongRouteKm: km,
    distanceFromRouteKm: 2,
  }
}

describe('tripRouteDensity', () => {
  it('adapte la taille des tranches à la distance', () => {
    expect(routeDensityBinSizeKm(50)).toBe(10)
    expect(routeDensityBinSizeKm(250)).toBe(20)
    expect(rollingWindowKm(250)).toBe(35)
  })

  it('répartit les stations dans les tranches', () => {
    const bins = computeRouteDensityBins(100, [stationAt(5), stationAt(25), stationAt(26)], 20)
    expect(bins).toHaveLength(5)
    expect(bins[0]?.count).toBe(1)
    expect(bins[1]?.count).toBe(2)
    expect(bins[0]?.pdcCount).toBe(2)
  })

  it('calcule une densité glissante lissée', () => {
    const stations = [stationAt(10), stationAt(12), stationAt(200)]
    const samples = computeRollingRouteDensity(220, stations, 30, 10)
    const peak = samples.reduce(
      (best, sample) => (sample.stationCount > best.stationCount ? sample : best),
      samples[0]!,
    )
    expect(peak.stationCount).toBeGreaterThanOrEqual(2)
    expect(sumRoutePdc(stations)).toBe(6)
  })

  it('détecte les intervalles sans station et les grands écarts', () => {
    const stations = [stationAt(0), stationAt(200)]
    const samples = computeRollingRouteDensity(220, stations, 30, 10)
    const sparse = computeSparseRouteBands(samples)
    expect(sparse.length).toBeGreaterThan(0)

    const gaps = computeRouteGapBands(220, stations, routeGapWarningKm(400))
    expect(gaps.some((band) => band.gapKm >= 80)).toBe(true)
  })

  it('plafonne l’échelle pour les agglomérations denses', () => {
    const dense = Array.from({ length: 25 }, (_, i) => stationAt(i))
    const samples = computeRollingRouteDensity(200, dense, 30, 10)
    const scaleMax = routeDensityScaleMax(samples.map((sample) => sample.stationCount))
    expect(scaleMax).toBe(MAX_DENSITY_BIN_SCALE)
  })

  it('génère des graduations lisibles', () => {
    expect(routeDensityTicks(460)).toEqual([0, 100, 200, 300, 400, 460])
  })

  it('trace des courbes avec des trous de prix', () => {
    const paths = buildSvgLinePathsWithGaps([
      { x: 0, y: 10 },
      { x: 10, y: 20 },
      { x: 20, y: null },
      { x: 30, y: 15 },
      { x: 40, y: 18 },
    ])
    expect(paths).toHaveLength(2)
  })

  it('adapte l’échelle €/kWh', () => {
    const scale = routePriceScale([0.39, 0.51, 0.62])
    expect(scale.min).toBeLessThan(0.39)
    expect(scale.max).toBeGreaterThan(0.62)
  })
})
