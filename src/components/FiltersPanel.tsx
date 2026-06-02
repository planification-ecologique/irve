import { useMemo, useState } from 'react'
import type { Station, ConnectorType } from '../types/irve'
import { TRANSPORT_IRVE_DATASET_URL, SLOW_MAX_POWER_KW } from '../api/transportIrve'
import {
  MIN_POWER_THRESHOLDS,
  SLOW_ONLY_MIN_POWER,
  getPowerThresholdClass,
  getSlowPowerThresholdClass,
  isSlowOnlyPowerFilter,
  POWER_LABELS,
} from '../lib/power'
import { CONNECTOR_META, CONNECTOR_FILTER_TYPES, stationHasConnector } from '../lib/connectors'
import { isStaticStation } from '../lib/stationOrigin'
import { matchesAvailabilityFilter, type AvailabilityFilter } from '../lib/stations'
import { getOperatorOptionsWithCounts, getOperatorRequiredNote, stationMatchesOperator } from '../lib/operators'
import { ConnectorIcon } from './ConnectorIcon'

export type { AvailabilityFilter }

const AVAILABILITY_OPTIONS: {
  value: AvailabilityFilter
  label: string
  chipClass: string
  hint?: string
}[] = [
  { value: 'all', label: 'Toutes', chipClass: 'chip--avail-all' },
  { value: 'available', label: 'Avec dispo', chipClass: 'chip--avail-available' },
  { value: 'full', label: 'Pleines', chipClass: 'chip--avail-full' },
  {
    value: 'out_of_service',
    label: 'HS',
    chipClass: 'chip--avail-out',
    hint: 'Stations sans aucune prise opérationnelle. Les pannes partielles (une partie des PDC hors service) restent visibles dans « Toutes ».',
  },
]

export interface FilterState {
  search: string
  operator: string | null
  minPower: number
  connector: ConnectorType | null
  availability: AvailabilityFilter
}

export const defaultFilters: FilterState = {
  search: '',
  operator: null,
  minPower: 50,
  connector: null,
  availability: 'all',
}

export function countActiveFilters(
  filters: FilterState,
  addSlowLayer = false,
): number {
  let count = 0
  if (addSlowLayer) count++
  if (filters.search.trim()) count++
  if (filters.operator) count++
  if (isSlowOnlyPowerFilter(filters.minPower) || filters.minPower !== defaultFilters.minPower) {
    count++
  }
  if (filters.connector) count++
  if (!isSlowOnlyPowerFilter(filters.minPower) && filters.availability !== defaultFilters.availability) {
    count++
  }
  return count
}

export function useFilterState() {
  return useState<FilterState>(defaultFilters)
}

export function filterStations(
  stations: Station[] | undefined,
  filters: FilterState,
  addSlowLayer: boolean,
): Station[] {
  if (!stations) return []

  const query = filters.search.trim().toLowerCase()
  const slowOnlyView = isSlowOnlyPowerFilter(filters.minPower)
  const includeSlow = addSlowLayer || slowOnlyView

  return stations.filter((station) => {
      const isStatic = isStaticStation(station)

      if (slowOnlyView) {
        if (!includeSlow || !isStatic) return false
        if (station.summary.max_power >= SLOW_MAX_POWER_KW) return false
      } else if (isStatic) {
        if (!includeSlow) return false
        if (station.summary.max_power >= SLOW_MAX_POWER_KW) return false
      } else {
        if (station.summary.max_power < filters.minPower) return false
        if (!matchesAvailabilityFilter(station, filters.availability)) return false
      }

      if (!stationMatchesOperator(station, filters.operator)) return false

      const connectorMinPower = isStatic || slowOnlyView ? 0 : filters.minPower
      if (filters.connector && !stationHasConnector(station.summary, filters.connector, connectorMinPower)) {
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
}

export function useFilteredStations(
  stations: Station[] | undefined,
  filters: FilterState,
  addSlowLayer: boolean,
) {
  return useMemo(
    () => filterStations(stations, filters, addSlowLayer),
    [stations, filters, addSlowLayer],
  )
}

interface FiltersPanelProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  stations: Station[]
  totalCount: number
  filteredCount: number
  addSlowLayer: boolean
  slowLoading: boolean
  onAddSlowLayerChange: (enabled: boolean) => void
}

export function FiltersPanel({
  filters,
  onChange,
  stations,
  totalCount,
  filteredCount,
  addSlowLayer,
  slowLoading,
  onAddSlowLayerChange,
}: FiltersPanelProps) {
  const [outOfServiceHintOpen, setOutOfServiceHintOpen] = useState(false)
  const operatorOptions = useMemo(
    () => getOperatorOptionsWithCounts(stations),
    [stations],
  )

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

      <label className="field">
        <span>Opérateur</span>
        <select
          value={filters.operator ?? ''}
          onChange={(event) =>
            onChange({
              ...filters,
              operator: event.target.value || null,
            })
          }
        >
          <option value="">Tous les opérateurs</option>
          {operatorOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label} ({option.count.toLocaleString('fr-FR')})
            </option>
          ))}
        </select>
        {filters.operator && getOperatorRequiredNote(filters.operator) && (
          <span className="field__hint">{getOperatorRequiredNote(filters.operator)}</span>
        )}
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
          <button
            type="button"
            className={`chip ${getSlowPowerThresholdClass(22)}${isSlowOnlyPowerFilter(filters.minPower) ? ' chip--active' : ''}`}
            onClick={() => onChange({ ...filters, minPower: SLOW_ONLY_MIN_POWER })}
            title={`Bornes statiques uniquement (< ${SLOW_MAX_POWER_KW} kW, transport.data.gouv.fr)`}
          >
            &lt; {SLOW_MAX_POWER_KW} kW
          </button>
        </div>
      </div>

      <div className="field">
        <span>Connecteurs</span>
        <div className="connector-filters">
          {CONNECTOR_FILTER_TYPES.map((connector) => {
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

      {!isSlowOnlyPowerFilter(filters.minPower) && (
      <div className="field">
        <span>Disponibilité</span>
        <div className="chip-group chip-group--availability">
          {AVAILABILITY_OPTIONS.map(({ value, label, chipClass, hint }) =>
            hint ? (
              <div key={value} className="chip-with-info">
                <button
                  type="button"
                  className={`chip chip--availability ${chipClass}${filters.availability === value ? ' chip--active' : ''}`}
                  onClick={() => onChange({ ...filters, availability: value })}
                >
                  {label}
                </button>
                <button
                  type="button"
                  className={`chip__info${outOfServiceHintOpen ? ' chip__info--open' : ''}`}
                  aria-expanded={outOfServiceHintOpen}
                  aria-label="Explication du filtre Hors service"
                  onClick={() => setOutOfServiceHintOpen((open) => !open)}
                >
                  i
                </button>
              </div>
            ) : (
              <button
                key={value}
                type="button"
                className={`chip chip--availability ${chipClass}${filters.availability === value ? ' chip--active' : ''}`}
                onClick={() => onChange({ ...filters, availability: value })}
              >
                {label}
              </button>
            ),
          )}
        </div>
        {outOfServiceHintOpen && (
          <p className="field__hint field__hint--info">{AVAILABILITY_OPTIONS.find((o) => o.hint)?.hint}</p>
        )}
      </div>
      )}

      <div className="filters-panel__footer">
        <button
          type="button"
          className={`slow-switch${addSlowLayer ? ' slow-switch--on' : ''}`}
          role="switch"
          aria-checked={addSlowLayer}
          disabled={slowLoading}
          title={TRANSPORT_IRVE_DATASET_URL}
          onClick={() => onAddSlowLayerChange(!addSlowLayer)}
        >
          <span className="slow-switch__track" aria-hidden="true">
            <span className="slow-switch__thumb" />
          </span>
          <span className="slow-switch__text">
            {slowLoading
              ? 'Chargement…'
              : `Ajouter les bornes lentes (< ${SLOW_MAX_POWER_KW} kW)`}
          </span>
        </button>
      </div>
    </section>
  )
}
