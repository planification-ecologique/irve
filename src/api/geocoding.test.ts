import { describe, expect, it } from 'vitest'
import { cityNameFromBanFeature, isBanArrondissement } from '../api/geocoding'
import { formatTripCityLabel } from '../lib/buildTrip'

describe('isBanArrondissement', () => {
  it('repère les arrondissements Paris/Lyon/Marseille', () => {
    expect(isBanArrondissement('Paris 11e Arrondissement')).toBe(true)
    expect(isBanArrondissement('Lyon 3e Arrondissement')).toBe(true)
    expect(isBanArrondissement('Marseille 13e Arrondissement')).toBe(true)
  })

  it('conserve les communes simples', () => {
    expect(isBanArrondissement('Paris')).toBe(false)
    expect(isBanArrondissement('Lyon')).toBe(false)
    expect(isBanArrondissement('Nantes')).toBe(false)
  })
})

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
