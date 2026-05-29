import { useMemo, useState } from 'react'
import type { Station, ConnectorType } from '../types/irve'
import {
  MIN_POWER_THRESHOLDS,
  getPowerThresholdClass,
  POWER_LABELS,
} from '../lib/power'
import { CONNECTOR_META, CONNECTOR_TYPES, stationHasConnector } from '../lib/connectors'
import { matchesAvailabilityFilter, type AvailabilityFilter } from '../lib/stations'
import { ConnectorIcon } from './ConnectorIcon'

export type { AvailabilityFilter }

export interface FilterState {
  search: string
  minPower: number
  connector: ConnectorType | null
  availability: AvailabilityFilter
}

export const defaultFilters: FilterState = {
  search: '',
  minPower: 50,
  connector: null,
  availability: 'all',
}

export function useFilteredStations(stations: Station[] | undefined) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters)

  const filtered = useMemo(() => {
    if (!stations) return []

    const query = filters.search.trim().toLowerCase()

    return stations.filter((station) => {
      if (station.summary.max_power < filters.minPower) return false
      if (!matchesAvailabilityFilter(station, filters.availability)) return false

      if (filters.connector && !stationHasConnector(station.summary, filters.connector)) {
        return false
      }

      if (query) {
        const haystack = [
          station.nom_station,
          station.nom_operateur,
          station.nom_amenageur,
        ]
          .join(' ')
          .toLowerCase()

        if (!haystack.includes(query)) return false
      }

      return true
    })
  }, [stations, filters])

  return { filters, setFilters, filtered }
}

interface FiltersPanelProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  totalCount: number
  filteredCount: number
}

export function FiltersPanel({
  filters,
  onChange,
  totalCount,
  filteredCount,
}: FiltersPanelProps) {
  const selectConnector = (connector: ConnectorType) => {
    onChange({
      ...filters,
      connector: filters.connector === connector ? null : connector,
    })
  }

  return (
    <section className="filters-panel">
      <div className="filters-panel__header">
        <h2>Filtres</h2>
        <span className="filters-panel__count">
          {filteredCount.toLocaleString('fr-FR')} / {totalCount.toLocaleString('fr-FR')}
        </span>
      </div>

      <label className="field">
        <span>Recherche</span>
        <input
          type="search"
          placeholder="Station, opérateur…"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
        />
      </label>

      <div className="field">
        <span>Puissance min.</span>
        <div className="chip-group">
          {MIN_POWER_THRESHOLDS.map((threshold) => (
            <button
              key={threshold}
              type="button"
              className={`chip ${getPowerThresholdClass(threshold)}${filters.minPower === threshold ? ' chip--active' : ''}`}
              onClick={() => onChange({ ...filters, minPower: threshold })}
              title={POWER_LABELS[threshold]}
            >
              ≥{threshold} kW
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Connecteurs</span>
        <div className="connector-filters">
          {CONNECTOR_TYPES.map((connector) => {
            const active = filters.connector === connector
            const meta = CONNECTOR_META[connector]

            return (
              <button
                key={connector}
                type="button"
                className={`connector-filter${active ? ' connector-filter--active' : ''}`}
                onClick={() => selectConnector(connector)}
                title={meta.label}
                aria-pressed={active}
              >
                <ConnectorIcon type={connector} size={32} />
                <span>{meta.shortLabel}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="field">
        <span>Disponibilité</span>
        <div className="chip-group chip-group--availability">
          {(
            [
              ['all', 'Toutes'],
              ['available', 'Avec dispo'],
              ['full', 'Pleines'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip chip--availability${filters.availability === value ? ' chip--active' : ''}`}
              onClick={() => onChange({ ...filters, availability: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
