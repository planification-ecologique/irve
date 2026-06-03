import { describe, expect, it } from 'vitest'
import type { OperatorTariff } from '../data/operatorTariffs'
import {
  compareTariffsByBestDirectPrice,
  compareTariffsForTableSort,
  getBestDirectKwhPrice,
  nextTariffTableSort,
} from './tariffDisplay'
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
})

describe('nextTariffTableSort', () => {
  it('bascule asc/desc sur même colonne', () => {
    expect(nextTariffTableSort('label', 'asc', 'label')).toEqual({ key: 'label', dir: 'desc' })
    expect(nextTariffTableSort('label', 'desc', 'label')).toEqual({ key: 'label', dir: 'asc' })
  })
})
