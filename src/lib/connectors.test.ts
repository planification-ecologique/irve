import { describe, expect, it } from 'vitest'
import { isChademoOnlyWithoutCcs, stationHasEffectiveCcs } from './connectors'
import type { StationSummary } from '../types/irve'

function summary(overrides: Partial<StationSummary>): StationSummary {
  return {
    max_power: 50,
    total_power: 50,
    has_prise_type_ef: false,
    has_prise_type_2: false,
    has_prise_type_combo_ccs: false,
    has_prise_type_chademo: false,
    has_prise_type_autre: false,
    price_per_kwh: null,
    pricing_value: null,
    pricing_dimension: null,
    pricing_unit: null,
    pricing_status: 'UNKNOWN',
    pricing_headline: null,
    applicable_tariff_count: 0,
    ...overrides,
  }
}

describe('stationHasEffectiveCcs', () => {
  it('returns true when Combo CCS flag is set', () => {
    expect(stationHasEffectiveCcs(summary({ has_prise_type_combo_ccs: true }))).toBe(true)
  })

  it('infers CCS for mis-tagged DC Type 2 at ≥50 kW', () => {
    expect(
      stationHasEffectiveCcs(
        summary({ max_power: 150, has_prise_type_2: true, has_prise_type_combo_ccs: false }),
      ),
    ).toBe(true)
  })

  it('returns false for CHAdeMO-only stations', () => {
    expect(
      stationHasEffectiveCcs(summary({ max_power: 50, has_prise_type_chademo: true })),
    ).toBe(false)
  })
})

describe('isChademoOnlyWithoutCcs', () => {
  it('returns true for CHAdeMO without effective CCS', () => {
    expect(
      isChademoOnlyWithoutCcs(summary({ max_power: 50, has_prise_type_chademo: true })),
    ).toBe(true)
  })

  it('returns false when CHAdeMO is paired with CCS', () => {
    expect(
      isChademoOnlyWithoutCcs(
        summary({
          max_power: 150,
          has_prise_type_chademo: true,
          has_prise_type_combo_ccs: true,
        }),
      ),
    ).toBe(false)
  })
})
