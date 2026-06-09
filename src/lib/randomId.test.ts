import { describe, expect, it } from 'vitest'
import { isUuidV4, randomId } from './randomId'

describe('randomId', () => {
  it('returns a UUID v4 string', () => {
    expect(isUuidV4(randomId())).toBe(true)
  })

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 20 }, () => randomId()))
    expect(ids.size).toBe(20)
  })

  it('falls back when randomUUID is unavailable', () => {
    const originalRandomUUID = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    })

    try {
      expect(isUuidV4(randomId())).toBe(true)
    } finally {
      Object.defineProperty(crypto, 'randomUUID', {
        configurable: true,
        value: originalRandomUUID,
      })
    }
  })
})
