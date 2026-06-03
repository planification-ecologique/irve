import { describe, expect, it } from 'vitest'
import { formatMaxPowerKw, isPowerKnown } from './formatPower'

describe('formatMaxPowerKw', () => {
  it('formats positive power', () => {
    expect(formatMaxPowerKw(150)).toBe('150 kW')
  })

  it('returns NC for missing or invalid values', () => {
    expect(formatMaxPowerKw(0)).toBe('NC')
    expect(formatMaxPowerKw(-10)).toBe('NC')
    expect(formatMaxPowerKw(Number.NaN)).toBe('NC')
  })
})

describe('isPowerKnown', () => {
  it('accepts positive finite values', () => {
    expect(isPowerKnown(50)).toBe(true)
  })

  it('rejects zero, negative, and non-finite values', () => {
    expect(isPowerKnown(0)).toBe(false)
    expect(isPowerKnown(-1)).toBe(false)
    expect(isPowerKnown(Number.POSITIVE_INFINITY)).toBe(false)
  })
})
