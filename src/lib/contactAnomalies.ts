import type { AnalyticsMetric } from './analytics'
import { classifyOperatorContact, type OperatorContactIssue } from './operatorContact'
import { isStaticStation } from './stationOrigin'
import type { Station } from '../types/irve'

interface ContactBucket {
  stations: number
  pdc: number
}

function emptyBucket(): ContactBucket {
  return { stations: 0, pdc: 0 }
}

function addStation(bucket: ContactBucket, station: Station): void {
  bucket.stations += 1
  bucket.pdc += station.pdc_count
}

export interface ContactAnomalyWarning {
  id: OperatorContactIssue
  title: string
  description: string
  stations: number
  pdc: number
}

export function contactMetricValue(
  warning: ContactAnomalyWarning,
  metric: AnalyticsMetric,
): number {
  return metric === 'stations' ? warning.stations : warning.pdc
}

export function resolveStationTelephone(
  station: Station,
  contactByKey: ReadonlyMap<string, string | null> | null,
): string | null | undefined {
  if (station.telephone_operateur !== undefined) {
    return station.telephone_operateur
  }
  return contactByKey?.get(station.station_key)
}

/** Compte les contacts opérateur suspects (données live QualiCharge uniquement). */
export function computeContactAnomalyWarnings(
  stations: Station[],
  contactByKey: ReadonlyMap<string, string | null> | null,
): ContactAnomalyWarning[] {
  const hasContactData =
    contactByKey !== null ||
    stations.some((station) => !isStaticStation(station) && station.telephone_operateur !== undefined)

  if (!hasContactData) return []

  const buckets: Record<Exclude<OperatorContactIssue, 'ok'>, ContactBucket> = {
    missing: emptyBucket(),
    placeholder: emptyBucket(),
    invalid: emptyBucket(),
  }

  for (const station of stations) {
    if (isStaticStation(station)) continue

    const telephone = resolveStationTelephone(station, contactByKey)
    if (telephone === undefined) continue

    const issue = classifyOperatorContact(telephone)
    if (issue === 'ok') continue

    addStation(buckets[issue], station)
  }

  const defs: {
    id: Exclude<OperatorContactIssue, 'ok'>
    title: string
    description: string
  }[] = [
    {
      id: 'missing',
      title: 'Contact absent',
      description: 'Aucun numéro opérateur renseigné dans la fiche station QualiCharge.',
    },
    {
      id: 'placeholder',
      title: 'Numéro factice',
      description:
        'Valeur type 01 00 00 00 00 ou suite de chiffres identiques — probablement un placeholder, pas un vrai contact.',
    },
    {
      id: 'invalid',
      title: 'Format invalide',
      description: 'Numéro trop court, long ou ne correspond pas au format téléphone français attendu.',
    },
  ]

  return defs
    .filter(({ id }) => buckets[id].stations > 0)
    .map(({ id, title, description }) => ({
      id,
      title,
      description,
      stations: buckets[id].stations,
      pdc: buckets[id].pdc,
    }))
}
