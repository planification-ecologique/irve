import { isMisTaggedDcOnly, TYPE2_MAX_POWER_KW } from './connectors'
import type { Station } from '../types/irve'

const FAST_DC_MIN_KW = 50

interface AnomalyBucket {
  stations: number
  pdc: number
}

function emptyBucket(): AnomalyBucket {
  return { stations: 0, pdc: 0 }
}

function addStation(bucket: AnomalyBucket, station: Station): void {
  bucket.stations += 1
  bucket.pdc += station.pdc_count
}

export interface DataAnomalyWarning {
  id: string
  title: string
  description: string
  stations: number
  pdc: number
}

export function computeDataAnomalyWarnings(stations: Station[]): DataAnomalyWarning[] {
  const type2Ge50 = emptyBucket()
  const type2OverAc = emptyBucket()
  const misTaggedDc = emptyBucket()
  const fastWithoutDc = emptyBucket()
  const extremePower = emptyBucket()

  for (const station of stations) {
    const summary = station.summary
    const { max_power } = summary

    if (summary.has_prise_type_2 && max_power >= FAST_DC_MIN_KW) {
      addStation(type2Ge50, station)
    }

    if (
      summary.has_prise_type_2 &&
      max_power > TYPE2_MAX_POWER_KW &&
      max_power < FAST_DC_MIN_KW
    ) {
      addStation(type2OverAc, station)
    }

    if (isMisTaggedDcOnly(summary)) {
      addStation(misTaggedDc, station)
    }

    if (
      max_power >= FAST_DC_MIN_KW &&
      !summary.has_prise_type_combo_ccs &&
      !summary.has_prise_type_chademo
    ) {
      addStation(fastWithoutDc, station)
    }

    if (max_power > 400) {
      addStation(extremePower, station)
    }
  }

  const defs: { id: string; bucket: AnomalyBucket; title: string; description: string }[] = [
    {
      id: 'type2-ge-50',
      bucket: type2Ge50,
      title: 'Type 2 avec puissance ≥ 50 kW',
      description:
        'Une prise Type 2 AC ne dépasse pas ~43 kW en triphasé. Puissance ≥ 50 kW indique souvent un DC mal typé ou des métadonnées incohérentes.',
    },
    {
      id: 'type2-over-ac',
      bucket: type2OverAc,
      title: `Type 2 avec puissance > ${TYPE2_MAX_POWER_KW} kW`,
      description:
        'Puissance au-delà du maximum réaliste pour une borne AC Type 2 (hors cas DC ci-dessous).',
    },
    {
      id: 'mis-tagged-dc-type2',
      bucket: misTaggedDc,
      title: 'DC étiqueté uniquement en Type 2',
      description:
        'Puissance > 43 kW, flag Type 2 seul, sans Combo CCS ni CHAdeMO — schéma fréquent chez certains opérateurs (ex. Izivia).',
    },
    {
      id: 'fast-without-dc',
      bucket: fastWithoutDc,
      title: 'Rapide sans connecteur DC déclaré',
      description:
        'Puissance max. ≥ 50 kW mais ni Combo CCS ni CHAdeMO renseignés dans la fiche station.',
    },
    {
      id: 'extreme-power',
      bucket: extremePower,
      title: 'Puissance max. > 400 kW',
      description: 'Valeur exceptionnelle — vérifier la cohérence de la puissance nominale déclarée.',
    },
  ]

  return defs
    .filter(({ bucket }) => bucket.stations > 0)
    .map(({ id, title, description, bucket }) => ({
      id,
      title,
      description,
      stations: bucket.stations,
      pdc: bucket.pdc,
    }))
}
