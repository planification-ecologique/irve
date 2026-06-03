import { describe, expect, it } from 'vitest'
import {
  classifyOperatorContact,
  formatOperatorPhoneDisplay,
  normalizeOperatorPhoneDigits,
} from './operatorContact'

describe('operatorContact', () => {
  it('normalise tel:+33-1-00-00-00-00', () => {
    expect(normalizeOperatorPhoneDigits('tel:+33-1-00-00-00-00')).toBe('0100000000')
    expect(formatOperatorPhoneDisplay('tel:+33-1-00-00-00-00')).toBe('01 00 00 00 00')
    expect(classifyOperatorContact('tel:+33-1-00-00-00-00')).toBe('placeholder')
  })

  it('accepte un numéro réaliste', () => {
    expect(classifyOperatorContact('tel:+33-9-69-39-09-03')).toBe('ok')
  })

  it('marque absent', () => {
    expect(classifyOperatorContact(null)).toBe('missing')
    expect(classifyOperatorContact('')).toBe('missing')
  })
})
