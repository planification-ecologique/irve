import { isStaticStation } from './stationOrigin'
import type { Station } from '../types/irve'

export interface NamedCount {
  name: string
  stations: number
  pdc: number
}

export type AnalyticsMetric = 'stations' | 'pdc'

export interface OperatorPowerSegment {
  bucketId: string
  label: string
  color: string
  stations: number
  pdc: number
}

export interface OperatorStats {
  name: string
  stations: number
  pdc: number
  powerSegments: OperatorPowerSegment[]
}

export interface BucketCount {
  id: string
  label: string
  stations: number
  pdc: number
  color: string
}

export interface ConnectorStats {
  ccs: { stations: number; pdc: number }
  type2: { stations: number; pdc: number }
  chademo: { stations: number; pdc: number }
  ef: { stations: number; pdc: number }
  autre: { stations: number; pdc: number }
}

export function operatorMetricTotal(row: OperatorStats, metric: AnalyticsMetric): number {
  return metric === 'stations' ? row.stations : row.pdc
}

export function segmentMetricValue(segment: OperatorPowerSegment, metric: AnalyticsMetric): number {
  return metric === 'stations' ? segment.stations : segment.pdc
}

export function bucketMetricValue(bucket: BucketCount, metric: AnalyticsMetric): number {
  return metric === 'stations' ? bucket.stations : bucket.pdc
}

export function namedCountMetricValue(row: NamedCount, metric: AnalyticsMetric): number {
  return metric === 'stations' ? row.stations : row.pdc
}

export function connectorMetricValue(
  entry: { stations: number; pdc: number },
  metric: AnalyticsMetric,
): number {
  return metric === 'stations' ? entry.stations : entry.pdc
}

export interface LiveAvailabilityStats {
  totalPdc: number
  available: number
  occupied: number
  reserved: number
  outOfService: number
  stationsWithAvailability: number
  availabilityRate: number
}

export interface IrveAnalytics {
  totalStations: number
  totalPdc: number
  liveStations: number
  staticStations: number
  livePdc: number
  staticPdc: number
  avgPdcPerStation: number
  ultraFastStations: number
  highPowerStations: number
  withTarification: number
  gratuit: number
  paiementCb: number
  reservation: number
  deuxRoues: number
  operators: OperatorStats[]
  amenageurs: NamedCount[]
  powerBuckets: BucketCount[]
  connectors: ConnectorStats
  liveAvailability: LiveAvailabilityStats | null
}

const OPERATOR_UNKNOWN = 'Non renseigné'

export const ANALYTICS_POWER_BUCKETS: {
  id: string
  label: string
  min: number
  max: number
  color: string
}[] = [
  { id: 'p0', label: '< 7 kW', min: 0, max: 7, color: '#94a3b8' },
  { id: 'p7', label: '7–21 kW', min: 7, max: 22, color: '#a78bfa' },
  { id: 'p22', label: '22–49 kW', min: 22, max: 50, color: '#60a5fa' },
  { id: 'p50', label: '50–99 kW', min: 50, max: 100, color: '#38bdf8' },
  { id: 'p100', label: '100–149 kW', min: 100, max: 150, color: '#22d3ee' },
  { id: 'p150', label: '150–179 kW', min: 150, max: 180, color: '#22d3a5' },
  { id: 'p180', label: '180–349 kW', min: 180, max: 350, color: '#a3e635' },
  { id: 'p350', label: '≥ 350 kW', min: 350, max: Infinity, color: '#fbbf24' },
]

function normalizeOperatorName(name: string): string {
  const trimmed = name.trim()
  return trimmed || OPERATOR_UNKNOWN
}

function aggregateByField(
  stations: Station[],
  field: 'nom_operateur' | 'nom_amenageur',
  limit?: number,
): NamedCount[] {
  const map = new Map<string, { stations: number; pdc: number }>()

  for (const station of stations) {
    const raw = station[field]
    const name =
      field === 'nom_operateur' ? normalizeOperatorName(raw) : raw.trim() || OPERATOR_UNKNOWN
    const entry = map.get(name) ?? { stations: 0, pdc: 0 }
    entry.stations += 1
    entry.pdc += station.pdc_count
    map.set(name, entry)
  }

  const sorted = [...map.entries()]
    .map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => b.stations - a.stations || b.pdc - a.pdc)
  return limit === undefined ? sorted : sorted.slice(0, limit)
}

function powerBucketFor(maxPower: number): (typeof ANALYTICS_POWER_BUCKETS)[number] {
  for (let i = ANALYTICS_POWER_BUCKETS.length - 1; i >= 0; i--) {
    const bucket = ANALYTICS_POWER_BUCKETS[i]
    if (maxPower >= bucket.min) return bucket
  }
  return ANALYTICS_POWER_BUCKETS[0]
}

type BucketTotals = { stations: number; pdc: number }

function aggregateOperators(stations: Station[]): OperatorStats[] {
  const map = new Map<string, { stations: number; pdc: number; buckets: Map<string, BucketTotals> }>()

  for (const station of stations) {
    const name = normalizeOperatorName(station.nom_operateur)
    const entry = map.get(name) ?? { stations: 0, pdc: 0, buckets: new Map() }
    entry.stations += 1
    entry.pdc += station.pdc_count
    const bucket = powerBucketFor(station.summary.max_power)
    const bucketEntry = entry.buckets.get(bucket.id) ?? { stations: 0, pdc: 0 }
    bucketEntry.stations += 1
    bucketEntry.pdc += station.pdc_count
    entry.buckets.set(bucket.id, bucketEntry)
    map.set(name, entry)
  }

  return [...map.entries()].map(([name, data]) => ({
    name,
    stations: data.stations,
    pdc: data.pdc,
    powerSegments: ANALYTICS_POWER_BUCKETS.map((def) => {
      const totals = data.buckets.get(def.id) ?? { stations: 0, pdc: 0 }
      return {
        bucketId: def.id,
        label: def.label,
        color: def.color,
        stations: totals.stations,
        pdc: totals.pdc,
      }
    }).filter((segment) => segment.stations > 0 || segment.pdc > 0),
  }))
}

export function computeIrveAnalytics(stations: Station[]): IrveAnalytics {
  const live = stations.filter((s) => !isStaticStation(s))
  const staticStations = stations.filter((s) => isStaticStation(s))

  const totalPdc = stations.reduce((sum, s) => sum + s.pdc_count, 0)
  const livePdc = live.reduce((sum, s) => sum + s.pdc_count, 0)
  const staticPdc = staticStations.reduce((sum, s) => sum + s.pdc_count, 0)

  const bucketMap = new Map<string, BucketCount>()
  for (const def of ANALYTICS_POWER_BUCKETS) {
    bucketMap.set(def.id, { id: def.id, label: def.label, stations: 0, pdc: 0, color: def.color })
  }
  for (const station of stations) {
    const bucket = powerBucketFor(station.summary.max_power)
    const entry = bucketMap.get(bucket.id)!
    entry.stations += 1
    entry.pdc += station.pdc_count
  }

  const emptyConnector = () => ({ stations: 0, pdc: 0 })
  const connectors: ConnectorStats = {
    ccs: emptyConnector(),
    type2: emptyConnector(),
    chademo: emptyConnector(),
    ef: emptyConnector(),
    autre: emptyConnector(),
  }
  for (const station of stations) {
    const s = station.summary
    if (s.has_prise_type_combo_ccs) {
      connectors.ccs.stations += 1
      connectors.ccs.pdc += station.pdc_count
    }
    if (s.has_prise_type_2) {
      connectors.type2.stations += 1
      connectors.type2.pdc += station.pdc_count
    }
    if (s.has_prise_type_chademo) {
      connectors.chademo.stations += 1
      connectors.chademo.pdc += station.pdc_count
    }
    if (s.has_prise_type_ef) {
      connectors.ef.stations += 1
      connectors.ef.pdc += station.pdc_count
    }
    if (s.has_prise_type_autre) {
      connectors.autre.stations += 1
      connectors.autre.pdc += station.pdc_count
    }
  }

  let liveAvailability: LiveAvailabilityStats | null = null
  if (live.length > 0) {
    const totalPdcLive = livePdc
    const available = live.reduce((sum, s) => sum + s.dynamic_summary.available_count, 0)
    const occupied = live.reduce((sum, s) => sum + s.dynamic_summary.occupied_count, 0)
    const reserved = live.reduce((sum, s) => sum + s.dynamic_summary.reserved_count, 0)
    const outOfService = live.reduce(
      (sum, s) => sum + Math.max(0, s.pdc_count - s.dynamic_summary.en_service_count),
      0,
    )
    const stationsWithAvailability = live.filter(
      (s) => s.dynamic_summary.pdcs_with_dynamic_count > 0,
    ).length

    liveAvailability = {
      totalPdc: totalPdcLive,
      available,
      occupied,
      reserved,
      outOfService,
      stationsWithAvailability,
      availabilityRate: totalPdcLive > 0 ? (available / totalPdcLive) * 100 : 0,
    }
  }

  return {
    totalStations: stations.length,
    totalPdc,
    liveStations: live.length,
    staticStations: staticStations.length,
    livePdc,
    staticPdc,
    avgPdcPerStation: stations.length > 0 ? totalPdc / stations.length : 0,
    ultraFastStations: stations.filter((s) => s.summary.max_power >= 150).length,
    highPowerStations: stations.filter((s) => s.summary.max_power >= 100).length,
    withTarification: stations.filter((s) => s.has_tarification).length,
    gratuit: stations.filter((s) => s.gratuit === true).length,
    paiementCb: stations.filter((s) => s.paiement_cb === true).length,
    reservation: stations.filter((s) => s.reservation).length,
    deuxRoues: stations.filter((s) => s.station_deux_roues).length,
    operators: aggregateOperators(stations),
    amenageurs: aggregateByField(stations, 'nom_amenageur'),
    powerBuckets: ANALYTICS_POWER_BUCKETS.map((def) => bucketMap.get(def.id)!),
    connectors,
    liveAvailability,
  }
}

export function formatAnalyticsPercent(value: number, total: number): string {
  if (total <= 0) return '0 %'
  return `${Math.round((value / total) * 100)} %`
}
