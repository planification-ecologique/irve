import type { ConnectorType } from '../types/irve'
import type { PdcDetail } from '../types/irve'
import { CONNECTOR_TYPES } from './connectors'

export type ConnectorSlotStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'out_of_service'
  | 'unknown'

export interface ConnectorTypeAvailability {
  type: ConnectorType
  total: number
  available: number
  occupied: number
  reserved: number
  outOfService: number
  unknown: number
  maxPowerKw: number
}

const CONNECTOR_FIELDS: Record<
  ConnectorType,
  { flag: keyof PdcDetail; state: keyof NonNullable<PdcDetail['dynamic']> }
> = {
  ef: { flag: 'prise_type_ef', state: 'etat_prise_type_ef' },
  type2: { flag: 'prise_type_2', state: 'etat_prise_type_2' },
  ccs: { flag: 'prise_type_combo_ccs', state: 'etat_prise_type_combo_ccs' },
  chademo: { flag: 'prise_type_chademo', state: 'etat_prise_type_chademo' },
}

function emptyCounts(): Omit<ConnectorTypeAvailability, 'type' | 'maxPowerKw'> {
  return {
    total: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    outOfService: 0,
    unknown: 0,
  }
}

export function getPdcConnectorTypes(pdc: PdcDetail): ConnectorType[] {
  return CONNECTOR_TYPES.filter((type) => Boolean(pdc[CONNECTOR_FIELDS[type].flag]))
}

export function getPdcConnectorStatus(pdc: PdcDetail, connector: ConnectorType): ConnectorSlotStatus {
  if (!pdc[CONNECTOR_FIELDS[connector].flag]) {
    return 'unknown'
  }

  const dynamic = pdc.dynamic
  if (!dynamic) {
    return 'unknown'
  }

  if (dynamic.etat_pdc !== 'en_service') {
    return 'out_of_service'
  }

  const connectorState = dynamic[CONNECTOR_FIELDS[connector].state]
  if (connectorState === 'en_panne') {
    return 'out_of_service'
  }

  switch (dynamic.occupation_pdc) {
    case 'libre':
      return 'available'
    case 'occupe':
      return 'occupied'
    case 'reserve':
      return 'reserved'
    default:
      return 'unknown'
  }
}

export function summarizeConnectorAvailability(pdcs: PdcDetail[]): ConnectorTypeAvailability[] {
  const byType = Object.fromEntries(
    CONNECTOR_TYPES.map((type) => [type, { ...emptyCounts(), type, maxPowerKw: 0 }]),
  ) as Record<ConnectorType, ConnectorTypeAvailability>

  for (const pdc of pdcs) {
    for (const connector of getPdcConnectorTypes(pdc)) {
      const bucket = byType[connector]
      bucket.total += 1
      bucket.maxPowerKw = Math.max(bucket.maxPowerKw, pdc.puissance_nominale)

      const status = getPdcConnectorStatus(pdc, connector)
      switch (status) {
        case 'available':
          bucket.available += 1
          break
        case 'occupied':
          bucket.occupied += 1
          break
        case 'reserved':
          bucket.reserved += 1
          break
        case 'out_of_service':
          bucket.outOfService += 1
          break
        default:
          bucket.unknown += 1
      }
    }
  }

  return CONNECTOR_TYPES.map((type) => byType[type]).filter((entry) => entry.total > 0)
}

export function formatConnectorAvailability(entry: ConnectorTypeAvailability): string {
  if (entry.available > 0) {
    return `${entry.available}/${entry.total} libre${entry.available > 1 ? 's' : ''}`
  }
  if (entry.occupied > 0) {
    return `${entry.occupied}/${entry.total} occupé${entry.occupied > 1 ? 's' : ''}`
  }
  if (entry.reserved > 0) {
    return `${entry.reserved}/${entry.total} réservé${entry.reserved > 1 ? 's' : ''}`
  }
  if (entry.outOfService > 0) {
    return `${entry.outOfService}/${entry.total} hors service`
  }
  if (entry.unknown > 0) {
    return `${entry.total} sans données live`
  }
  return `${entry.total} PDC`
}

export function getConnectorAvailabilityTone(
  entry: ConnectorTypeAvailability,
): 'available' | 'occupied' | 'unavailable' | 'unknown' {
  if (entry.available > 0) return 'available'
  if (entry.occupied > 0 || entry.reserved > 0) return 'occupied'
  if (entry.outOfService > 0) return 'unavailable'
  return 'unknown'
}
