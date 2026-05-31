import { useCallback, useState } from 'react'
import { useIrveData } from './hooks/useIrveData'
import { useTheme } from './hooks/useTheme'
import { countActiveFilters, useFilteredStations } from './components/FiltersPanel'
import { IrveMap } from './components/IrveMap'
import { StatsBar } from './components/StatsBar'
import { FiltersPanel } from './components/FiltersPanel'
import { StationDetail } from './components/StationDetail'
import type { Station } from './types/irve'
import './App.css'

function App() {
  const { theme, toggleTheme } = useTheme()
  const { data, dataSource, lastFetchedAt, loading, error, refetch } = useIrveData()
  const { filters, setFilters, filtered } = useFilteredStations(data?.stations)
  const [selected, setSelected] = useState<Station | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const handleSelect = useCallback((station: Station | null) => {
    setSelected(station)
    if (station) setFiltersOpen(false)
  }, [])

  const activeFilterCount = countActiveFilters(filters)

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
            stations={data?.stations ?? []}
            totalCount={data?.stations.length ?? 0}
            filteredCount={filtered.length}
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
          {error && (
            <div className="map-overlay map-overlay--error">
              <p>{error}</p>
              <button type="button" onClick={refetch}>
                Réessayer
              </button>
            </div>
          )}

          {loading && !data && (
            <div className="map-overlay map-overlay--loading">
              <div className="spinner" />
              <p>Chargement des stations IRVE…</p>
            </div>
          )}

          {data && (
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
