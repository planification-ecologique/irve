import { stationHasAvailablePrice, stationHasQualichargePricing } from './tariffDisplay'
import type { Station } from '../types/irve'

export interface TariffCoverageBucket {
  stations: number
  pdc: number
}

export interface TariffCoverageSummary {
  totalStations: number
  totalPdc: number
  qualicharge: TariffCoverageBucket
  editorial: TariffCoverageBucket
  displayable: TariffCoverageBucket
}

export interface OperatorTariffCoverageRow {
  operator: string
  totalStations: number
  totalPdc: number
  qualichargeStations: number
  qualichargePdc: number
  displayableStations: number
  displayablePdc: number
}

function addStationToBucket(bucket: TariffCoverageBucket, station: Pick<Station, 'pdc_count'>): void {
  bucket.stations += 1
  bucket.pdc += station.pdc_count
}

export function computeTariffCoverageSummary(stations: readonly Station[]): TariffCoverageSummary {
  const qualicharge: TariffCoverageBucket = { stations: 0, pdc: 0 }
  const editorial: TariffCoverageBucket = { stations: 0, pdc: 0 }
  const displayable: TariffCoverageBucket = { stations: 0, pdc: 0 }

  for (const station of stations) {
    const hasQualicharge = stationHasQualichargePricing(station)
    const hasDisplayable = stationHasAvailablePrice(station)

    if (hasQualicharge) addStationToBucket(qualicharge, station)
    if (hasDisplayable && !hasQualicharge) addStationToBucket(editorial, station)
    if (hasDisplayable) addStationToBucket(displayable, station)
  }

  return {
    totalStations: stations.length,
    totalPdc: stations.reduce((sum, station) => sum + station.pdc_count, 0),
    qualicharge,
    editorial,
    displayable,
  }
}

export function computeOperatorTariffCoverage(
  stations: readonly Station[],
): OperatorTariffCoverageRow[] {
  const byOperator = new Map<string, OperatorTariffCoverageRow>()

  for (const station of stations) {
    const operator = station.nom_operateur?.trim() || 'Non renseigné'
    let row = byOperator.get(operator)
    if (!row) {
      row = {
        operator,
        totalStations: 0,
        totalPdc: 0,
        qualichargeStations: 0,
        qualichargePdc: 0,
        displayableStations: 0,
        displayablePdc: 0,
      }
      byOperator.set(operator, row)
    }

    row.totalStations += 1
    row.totalPdc += station.pdc_count

    if (stationHasQualichargePricing(station)) {
      row.qualichargeStations += 1
      row.qualichargePdc += station.pdc_count
    }
    if (stationHasAvailablePrice(station)) {
      row.displayableStations += 1
      row.displayablePdc += station.pdc_count
    }
  }

  return [...byOperator.values()].sort(
    (a, b) => b.displayablePdc - a.displayablePdc || b.totalPdc - a.totalPdc,
  )
}

export function formatTariffCoveragePercent(count: number, total: number): string {
  if (total <= 0) return '0 %'
  const pct = (count / total) * 100
  if (pct >= 10 || pct === 0) return `${Math.round(pct)} %`
  return `${pct.toFixed(1).replace('.', ',')} %`
}

export interface TariffFicheCoverage {
  totalPdc: number
  qualichargePdc: number
  displayablePdc: number
}

/** Couverture PDC par fiche opérateur (`match` → `nom_operateur`). */
export function computeTariffFicheCoverageByTariff(
  stations: readonly Station[],
  tariffs: readonly { id: string; match: readonly string[] }[],
): Map<string, TariffFicheCoverage> {
  const map = new Map<string, TariffFicheCoverage>()
  for (const tariff of tariffs) {
    const names = new Set(tariff.match)
    let totalPdc = 0
    let qualichargePdc = 0
    let displayablePdc = 0
    for (const station of stations) {
      if (!station.nom_operateur || !names.has(station.nom_operateur)) continue
      totalPdc += station.pdc_count
      if (stationHasQualichargePricing(station)) qualichargePdc += station.pdc_count
      if (stationHasAvailablePrice(station)) displayablePdc += station.pdc_count
    }
    if (totalPdc > 0) {
      map.set(tariff.id, { totalPdc, qualichargePdc, displayablePdc })
    }
  }
  return map
}

export function formatPdcCoverageCell(pricedPdc: number, totalPdc: number): string | null {
  if (totalPdc <= 0 || pricedPdc <= 0) return null
  return formatTariffCoveragePercent(pricedPdc, totalPdc)
}

export function formatPdcCoverageTitle(
  label: string,
  pricedPdc: number,
  totalPdc: number,
): string {
  const countFmt = new Intl.NumberFormat('fr-FR')
  return `${label} : ${countFmt.format(pricedPdc)} PDC sur ${countFmt.format(totalPdc)}`
}
