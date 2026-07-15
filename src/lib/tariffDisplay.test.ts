import { describe, expect, it } from 'vitest'
import type { OperatorTariff } from '../data/operatorTariffs'
import {
  classifyStationTariffQuality,
  compareTariffsByBestDirectPrice,
  compareTariffsForTableSort,
  computeQualichargePdcCoverageByTariff,
  computeStationTariffQualityBreakdown,
  formatQualichargePdcCoveragePct,
  formatTariffTierPrice,
  getBestDirectKwhPrice,
  nextTariffTableSort,
  getStationPricePerKwhBounds,
  stationHasAvailablePrice,
  stationMatchesMaxPriceFilter,
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

describe('stationHasAvailablePrice', () => {
  const base = {
    station_key: 'k',
    id: 1,
    lat: 0,
    lng: 0,
    id_station_itinerance: 'FR',
    nom_station: 'S',
    nom_amenageur: 'A',
    condition_acces: '',
    accessibilite_pmr: '',
    gratuit: false,
    paiement_acte: true,
    paiement_cb: true,
    reservation: false,
    station_deux_roues: false,
    pdc_count: 1,
    pdc_itinerance_ids: [],
    has_tarification: false,
    dynamic_summary: {
      pdcs_with_dynamic_count: 0,
      en_service_count: 0,
      libre_count: 0,
      occupied_count: 0,
      reserved_count: 0,
      available_count: 0,
    },
  } satisfies Omit<Station, 'nom_operateur' | 'summary'>

  it('true si pricing_headline QualiCharge', () => {
    const s: Station = {
      ...base,
      nom_operateur: 'DRIVECO',
      summary: {
        max_power: 150,
        total_power: 150,
        has_prise_type_ef: false,
        has_prise_type_2: false,
        has_prise_type_combo_ccs: true,
        has_prise_type_chademo: false,
        has_prise_type_autre: false,
        price_per_kwh: null,
        pricing_value: null,
        pricing_dimension: null,
        pricing_unit: null,
        pricing_status: 'OK',
        pricing_headline: '0,45 €/kWh',
        applicable_tariff_count: 1,
      },
    }
    expect(stationHasAvailablePrice(s)).toBe(true)
  })

  it('true si tarif opérateur affichable', () => {
    expect(
      stationHasAvailablePrice({
        ...base,
        nom_operateur: 'NW IECharge',
        summary: {
          max_power: 150,
          total_power: 150,
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
      }),
    ).toBe(true)
  })

  it('false sans prix station ni grille opérateur', () => {
    expect(
      stationHasAvailablePrice({
        ...base,
        nom_operateur: 'DRIVECO',
        summary: {
          max_power: 150,
          total_power: 150,
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
      }),
    ).toBe(false)
  })
})

describe('getStationPricePerKwhBounds', () => {
  const base = {
    station_key: 'k',
    id: 1,
    lat: 0,
    lng: 0,
    id_station_itinerance: 'FR',
    nom_station: 'S',
    nom_amenageur: 'A',
    condition_acces: '',
    accessibilite_pmr: '',
    gratuit: false,
    paiement_acte: true,
    paiement_cb: true,
    reservation: false,
    station_deux_roues: false,
    pdc_count: 1,
    pdc_itinerance_ids: [],
    has_tarification: false,
    dynamic_summary: {
      pdcs_with_dynamic_count: 0,
      en_service_count: 0,
      libre_count: 0,
      occupied_count: 0,
      reserved_count: 0,
      available_count: 0,
    },
  } satisfies Omit<Station, 'nom_operateur' | 'summary'>

  it('retourne price_per_kwh QualiCharge', () => {
    const bounds = getStationPricePerKwhBounds({
      ...base,
      nom_operateur: 'X',
      summary: {
        max_power: 150,
        total_power: 150,
        has_prise_type_ef: false,
        has_prise_type_2: false,
        has_prise_type_combo_ccs: true,
        has_prise_type_chademo: false,
        has_prise_type_autre: false,
        price_per_kwh: 0.42,
        pricing_value: null,
        pricing_dimension: null,
        pricing_unit: null,
        pricing_status: 'OK',
        pricing_headline: null,
        applicable_tariff_count: 1,
      },
    })
    expect(bounds).toEqual({ min: 0.42, max: 0.42 })
  })

  it('retourne fourchette opérateur (max = valueMax)', () => {
    const bounds = getStationPricePerKwhBounds({
      ...base,
      nom_operateur: 'Tesla',
      summary: {
        max_power: 150,
        total_power: 150,
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
    })
    expect(bounds).not.toBeNull()
    expect(bounds!.min).toBeLessThan(bounds!.max)
  })
})

describe('stationMatchesMaxPriceFilter', () => {
  it('accepte si borne haute ≤ plafond', () => {
    const station = {
      station_key: 'k',
      id: 1,
      lat: 0,
      lng: 0,
      id_station_itinerance: 'FR',
      nom_station: 'S',
      nom_operateur: 'NW IECharge',
      nom_amenageur: 'A',
      condition_acces: '',
      accessibilite_pmr: '',
      gratuit: false,
      paiement_acte: true,
      paiement_cb: true,
      reservation: false,
      station_deux_roues: false,
      pdc_count: 1,
      pdc_itinerance_ids: [],
      has_tarification: false,
      summary: {
        max_power: 150,
        total_power: 150,
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
        pdcs_with_dynamic_count: 0,
        en_service_count: 0,
        libre_count: 0,
        occupied_count: 0,
        reserved_count: 0,
        available_count: 0,
      },
    } satisfies Station
    expect(stationMatchesMaxPriceFilter(station, 0.3)).toBe(true)
    expect(stationMatchesMaxPriceFilter(station, 0.2)).toBe(false)
  })
})

describe('computeQualichargePdcCoverageByTariff', () => {
  it('pondère par pdc_count sur les noms QualiCharge matchés', () => {
    const stations = [
      {
        nom_operateur: 'Lidl France',
        pdc_count: 10,
        summary: { price_per_kwh: 0.29 },
      },
      {
        nom_operateur: 'Lidl France',
        pdc_count: 5,
        summary: { price_per_kwh: null, pricing_value: null },
      },
      {
        nom_operateur: 'DRIVECO',
        pdc_count: 8,
        summary: { price_per_kwh: 0.45 },
      },
    ] as Station[]

    const map = computeQualichargePdcCoverageByTariff(stations, [
      { id: 'lidl', match: ['Lidl France'] },
      { id: 'driveco', match: ['DRIVECO'] },
    ])

    expect(map.get('lidl')).toEqual({ pricedPdc: 10, totalPdc: 15 })
    expect(map.get('driveco')).toEqual({ pricedPdc: 8, totalPdc: 8 })
    expect(formatQualichargePdcCoveragePct(map.get('lidl')!)).toBe('67')
    expect(formatQualichargePdcCoveragePct(map.get('driveco')!)).toBe('100')
  })
})

describe('classifyStationTariffQuality', () => {
  const baseSummary = {
    max_power: 150,
    total_power: 150,
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
  } as const

  it('tarif QualiCharge → qualicharge', () => {
    expect(
      classifyStationTariffQuality({
        nom_operateur: 'DRIVECO',
        summary: { ...baseSummary, price_per_kwh: 0.45, pricing_status: 'STANDARD' },
      }),
    ).toBe('qualicharge')
  })

  it('grille fixe haute confiance → fiable', () => {
    expect(
      classifyStationTariffQuality({
        nom_operateur: 'NW IECharge',
        summary: baseSummary,
      }),
    ).toBe('reliable')
  })

  it('fourchette nationale → approximative', () => {
    expect(
      classifyStationTariffQuality({
        nom_operateur: 'Tesla',
        summary: baseSummary,
      }),
    ).toBe('approximate')
  })

  it('sans grille affichable → manquante', () => {
    expect(
      classifyStationTariffQuality({
        nom_operateur: 'DRIVECO',
        summary: baseSummary,
      }),
    ).toBe('missing')
  })
})

describe('computeStationTariffQualityBreakdown', () => {
  const baseSummary = {
    max_power: 150,
    total_power: 150,
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
  } as const

  it('somme les quatre catégories', () => {
    const stations = [
      {
        nom_operateur: 'Atlante France',
        pdc_count: 1,
        summary: { ...baseSummary, price_per_kwh: 0.59 },
      },
      { nom_operateur: 'NW IECharge', pdc_count: 1, summary: baseSummary },
      { nom_operateur: 'Tesla', pdc_count: 1, summary: baseSummary },
      { nom_operateur: 'DRIVECO', pdc_count: 1, summary: baseSummary },
    ] as Station[]
    const b = computeStationTariffQualityBreakdown(stations)
    expect(b.total).toBe(4)
    expect(b.qualicharge).toBe(1)
    expect(b.reliable + b.approximate + b.missing).toBe(3)
  })
})

describe('nextTariffTableSort', () => {
  it('bascule asc/desc sur même colonne', () => {
    expect(nextTariffTableSort('label', 'asc', 'label')).toEqual({ key: 'label', dir: 'desc' })
    expect(nextTariffTableSort('label', 'desc', 'label')).toEqual({ key: 'label', dir: 'asc' })
  })
})
