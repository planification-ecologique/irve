import { describe, expect, it } from 'vitest'
import { cityNameFromBanFeature } from '../api/geocoding'
import { formatTripCityLabel } from '../lib/buildTrip'

describe('cityNameFromBanFeature', () => {
  it('utilise le champ city', () => {
    expect(
      cityNameFromBanFeature({
        properties: { label: '12 Rue de Rivoli, 75001 Paris', city: 'Paris', score: 0.9 },
        geometry: { coordinates: [2.35, 48.86] },
      }),
    ).toBe('Paris')
  })

  it('utilise name pour une commune', () => {
    expect(
      cityNameFromBanFeature({
        properties: {
          label: 'Lyon',
          name: 'Lyon',
          type: 'municipality',
          score: 0.95,
        },
        geometry: { coordinates: [4.84, 45.76] },
      }),
    ).toBe('Lyon')
  })
})

describe('formatTripCityLabel', () => {
  it('extrait la ville depuis une adresse complète', () => {
    expect(formatTripCityLabel('12 Rue de Rivoli, 75001 Paris')).toBe('Paris')
  })

  it('conserve un libellé déjà court', () => {
    expect(formatTripCityLabel('Nantes')).toBe('Nantes')
  })
})
