import { useCallback, useMemo, useState } from 'react'
import { useIrveData } from './hooks/useIrveData'
import { useSlowIrveData } from './hooks/useSlowIrveData'
import { useTheme } from './hooks/useTheme'
import { countActiveFilters, useFilteredStations } from './components/FiltersPanel'
import { IrveMap } from './components/IrveMap'
import { StatsBar } from './components/StatsBar'
import { FiltersPanel } from './components/FiltersPanel'
import { StationDetail } from './components/StationDetail'
import { mergeStationLists } from './lib/stationOrigin'
import type { Station } from './types/irve'
import type { IrveDataSource } from './api/irve'
import './App.css'

function App() {
  const { theme, toggleTheme } = useTheme()
  const [includeSlow, setIncludeSlow] = useState(false)

  const { data: liveData, dataSource: liveSource, lastFetchedAt, loading: liveLoading, error: liveError, refetch } =
    useIrveData()
  const { data: slowData, loading: slowLoading, error: slowError } = useSlowIrveData(includeSlow)

  const mergedStations = useMemo(() => {
    const live = liveData?.stations ?? []
    const slow = includeSlow ? (slowData?.stations ?? []) : []
    return mergeStationLists(live, slow)
  }, [liveData, slowData, includeSlow])

  const data = useMemo(() => {
    if (!liveData && !slowData) return null
    const base = liveData ?? slowData!
    return { ...base, stations: mergedStations, total: mergedStations.length }
  }, [liveData, slowData, mergedStations])

  const dataSource: IrveDataSource | null = useMemo(() => {
    if (includeSlow && liveSource) {
      return liveSource === 'live' ? 'mixed' : liveSource
    }
    return liveSource
  }, [includeSlow, liveSource])

  const loading = liveLoading && !liveData
  const error = liveError
  const { filters, setFilters, filtered } = useFilteredStations(mergedStations, includeSlow)
  const [selected, setSelected] = useState<Station | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const handleIncludeSlowChange = useCallback((enabled: boolean) => {
    setIncludeSlow(enabled)
    setSelected(null)
  }, [])

  const handleSelect = useCallback((station: Station | null) => {
    setSelected(station)
    if (station) setFiltersOpen(false)
  }, [])

  const activeFilterCount = countActiveFilters(filters, includeSlow)

  return (
    <div className="app">
      <StatsBar
        stations={filtered}
        availability={filters.availability}
        updatedAt={data?.updatedAt ?? null}
        lastFetchedAt={lastFetchedAt}
        loading={loading}
        dataSource={dataSource}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="app__main">
        {filtersOpen && (
          <button
            type="button"
            className="filters-backdrop"
            aria-label="Fermer les filtres"
            onClick={() => setFiltersOpen(false)}
          />
        )}

        <aside className={`sidebar${filtersOpen ? ' sidebar--open' : ''}`}>
          <div className="sidebar__handle" aria-hidden="true" />

          <FiltersPanel
            filters={filters}
            onChange={setFilters}
            stations={mergedStations}
            totalCount={mergedStations.length}
            filteredCount={filtered.length}
            includeSlow={includeSlow}
            slowLoading={slowLoading}
            onIncludeSlowChange={handleIncludeSlowChange}
          />

          <p className="sidebar__source">
            Données{' '}
            <a
              href="https://www.qualicharge.beta.gouv.fr/cartographie/"
              target="_blank"
              rel="noreferrer"
            >
              QualiCharge
            </a>
            {includeSlow && (
              <>
                {' '}
                ·{' '}
                <a
                  href="https://transport.data.gouv.fr/datasets/beta-base-nationale-des-points-de-recharge-pour-vehicules-electriques-en-france-irve"
                  target="_blank"
                  rel="noreferrer"
                >
                  transport.data.gouv.fr
                </a>
                {' '}
                (&lt; 50 kW)
              </>
            )}
          </p>

          <button
            type="button"
            className="sidebar__close-mobile"
            onClick={() => setFiltersOpen(false)}
          >
            Appliquer
          </button>
        </aside>

        <div className="map-shell">
          <button
            type="button"
            className={`filters-toggle${activeFilterCount > 0 ? ' filters-toggle--active' : ''}`}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filtres
            {activeFilterCount > 0 && (
              <span className="filters-toggle__badge">{activeFilterCount}</span>
            )}
          </button>
          {includeSlow && slowError && (
            <div className="map-overlay map-overlay--error">
              <p>{slowError}</p>
            </div>
          )}
          {error && (
            <div className="map-overlay map-overlay--error">
              <p>{error}</p>
              <button type="button" onClick={refetch}>
                Réessayer
              </button>
            </div>
          )}

          {loading && !liveData && (
            <div className="map-overlay map-overlay--loading">
              <div className="spinner" />
              <p>Chargement des stations IRVE…</p>
            </div>
          )}

          {(liveData || mergedStations.length > 0) && (
            <IrveMap
              stations={filtered}
              selectedKey={selected?.station_key ?? null}
              onSelect={handleSelect}
              theme={theme}
            />
          )}

          {selected && (
            <StationDetail station={selected} onClose={() => handleSelect(null)} />
          )}
        </div>
      </main>
    </div>
  )
}

export default App
