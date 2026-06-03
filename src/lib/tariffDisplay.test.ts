import { describe, expect, it } from 'vitest'
import type { OperatorTariff } from '../data/operatorTariffs'
import {
  classifyStationTariffQuality,
  compareTariffsByBestDirectPrice,
  compareTariffsForTableSort,
  computeStationTariffQualityBreakdown,
  formatTariffTierPrice,
  getBestDirectKwhPrice,
  nextTariffTableSort,
  tariffHasDisplayablePrice,
} from './tariffDisplay'
import type { Station } from '../types/irve'
import { formatOperatorDirectPriceForRange } from './tariffPowerRanges'
import { TARIFF_POWER_RANGES } from './tariffPowerRanges'

const iecharge: OperatorTariff = {
  id: 'nw-iecharge',
  label: 'NW IECharge',
  match: ['NW IECharge'],
  pricingModel: 'national-fixed',
  directCbAvailable: true,
  tiers: [{ powerMinKw: null, powerMaxKw: null, value: 0.25, unit: '€/kWh', access: 'direct' }],
  source: 'https://iecharge.io/',
  checkedAt: '2026-06-03',
  confidence: 'high',
}

const lidl: OperatorTariff = {
  id: 'lidl',
  label: 'Lidl France',
  match: ['Lidl France'],
  pricingModel: 'national-fixed',
  directCbAvailable: null,
  tiers: [
    { powerMinKw: 0, powerMaxKw: 22, value: 0.29, unit: '€/kWh', access: 'direct' },
    { powerMinKw: 22, powerMaxKw: null, value: 0.39, unit: '€/kWh', access: 'direct' },
  ],
  source: 'https://www.lidl.fr/',
  checkedAt: '2026-06-03',
  confidence: 'high',
}

const tesla: OperatorTariff = {
  id: 'tesla',
  label: 'Tesla',
  match: ['Tesla'],
  pricingModel: 'national-range',
  directCbAvailable: null,
  tiers: [
    {
      powerMinKw: null,
      powerMaxKw: null,
      value: 0.39,
      valueMax: 0.44,
      unit: '€/kWh',
      access: 'direct',
    },
  ],
  source: 'https://www.tesla.com/',
  checkedAt: '2026-06-03',
  confidence: 'high',
}

describe('formatTariffTierPrice', () => {
  it('affiche une fourchette min–max', () => {
    expect(formatTariffTierPrice(tesla.tiers[0])).toMatch(/0,39.*0,44.*€\/kWh/)
  })
})

describe('tariffHasDisplayablePrice', () => {
  it('inclut national-range avec tier direct', () => {
    expect(tariffHasDisplayablePrice(tesla)).toBe(true)
  })
})

describe('formatOperatorDirectPriceForRange', () => {
  it('affiche la fourchette sur tous les paliers', () => {
    const label = formatOperatorDirectPriceForRange(tesla, TARIFF_POWER_RANGES[0])
    expect(label).toMatch(/0,39.*0,44/)
  })
})

describe('getBestDirectKwhPrice', () => {
  it('returns minimum direct €/kWh tier', () => {
    expect(getBestDirectKwhPrice(lidl)?.value).toBe(0.29)
    expect(getBestDirectKwhPrice(iecharge)?.value).toBe(0.25)
  })
})

describe('compareTariffsByBestDirectPrice', () => {
  it('orders cheaper operator first', () => {
    expect(compareTariffsByBestDirectPrice(iecharge, lidl)).toBeLessThan(0)
  })
})

describe('compareTariffsForTableSort', () => {
  const rangesById = new Map(TARIFF_POWER_RANGES.map((r) => [r.id, r]))

  it('tri par palier HPC', () => {
    expect(
      compareTariffsForTableSort(iecharge, lidl, 'range:hpc', 'asc', rangesById),
    ).toBeLessThan(0)
  })

  it('inverse le tri', () => {
    expect(
      compareTariffsForTableSort(iecharge, lidl, 'range:hpc', 'desc', rangesById),
    ).toBeGreaterThan(0)
  })

  it('tri par nombre de stations', () => {
    const counts = new Map([
      ['nw-iecharge', 300],
      ['lidl', 800],
    ])
    expect(
      compareTariffsForTableSort(iecharge, lidl, 'stations', 'desc', rangesById, counts),
    ).toBeGreaterThan(0)
  })
})

describe('classifyStationTariffQuality', () => {
  it('grille fixe haute confiance → fiable', () => {
    expect(classifyStationTariffQuality('NW IECharge')).toBe('reliable')
  })

  it('fourchette nationale → approximative', () => {
    expect(classifyStationTariffQuality('Tesla')).toBe('approximate')
  })

  it('sans grille affichable → manquante', () => {
    expect(classifyStationTariffQuality('DRIVECO')).toBe('missing')
  })
})

describe('computeStationTariffQualityBreakdown', () => {
  it('somme les trois catégories', () => {
    const stations = [
      { nom_operateur: 'NW IECharge', pdc_count: 1 },
      { nom_operateur: 'Tesla', pdc_count: 1 },
      { nom_operateur: 'DRIVECO', pdc_count: 1 },
    ] as Station[]
    const b = computeStationTariffQualityBreakdown(stations)
    expect(b.total).toBe(3)
    expect(b.reliable + b.approximate + b.missing).toBe(3)
  })
})

describe('nextTariffTableSort', () => {
  it('bascule asc/desc sur même colonne', () => {
    expect(nextTariffTableSort('label', 'asc', 'label')).toEqual({ key: 'label', dir: 'desc' })
    expect(nextTariffTableSort('label', 'desc', 'label')).toEqual({ key: 'label', dir: 'asc' })
  })
})
