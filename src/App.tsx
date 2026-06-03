import { useCallback, useEffect, useMemo, useState } from 'react'
import { useIrveData } from './hooks/useIrveData'
import { useSlowIrveData } from './hooks/useSlowIrveData'
import { useTheme } from './hooks/useTheme'
import {
  countActiveFilters,
  useFilterState,
  useFilteredStations,
} from './components/FiltersPanel'
import { AnalyticsPage } from './components/AnalyticsPage'
import { IrveMap } from './components/IrveMap'
import { StatsBar } from './components/StatsBar'
import { TariffsPage } from './components/TariffsPage'
import { getAppPage, isAnalyticsPath, isTariffsPath } from './lib/routes'
import { FiltersPanel } from './components/FiltersPanel'
import { StationDetail } from './components/StationDetail'
import { isSlowOnlyPowerFilter } from './lib/power'
import { mergeStationLists } from './lib/stationOrigin'
import type { Station } from './types/irve'
import type { IrveDataSource } from './api/irve'
import './App.css'

function App() {
  const { theme, toggleTheme } = useTheme()
  const [addSlowLayer, setAddSlowLayer] = useState(false)
  const [filters, setFilters] = useFilterState()

  const { data: liveData, dataSource: liveSource, lastFetchedAt, loading: liveLoading, error: liveError, refetch } =
    useIrveData()

  const includeSlowData = addSlowLayer || isSlowOnlyPowerFilter(filters.minPower)
  const { data: slowData, loading: slowLoading, error: slowError } = useSlowIrveData(includeSlowData)

  const mergedStations = useMemo(() => {
    const live = liveData?.stations ?? []
    const slow = includeSlowData ? (slowData?.stations ?? []) : []
    return mergeStationLists(live, slow)
  }, [liveData, slowData, includeSlowData])

  const filtered = useFilteredStations(mergedStations, filters, addSlowLayer)

  const data = useMemo(() => {
    if (!liveData && !slowData) return null
    const base = liveData ?? slowData!
    return { ...base, stations: mergedStations, total: mergedStations.length }
  }, [liveData, slowData, mergedStations])

  const dataSource: IrveDataSource | null = useMemo(() => {
    if (isSlowOnlyPowerFilter(filters.minPower) && !liveData) return 'transport-slow'
    if (includeSlowData && liveSource) {
      return liveSource === 'live' ? 'mixed' : liveSource
    }
    return liveSource
  }, [includeSlowData, liveSource, filters.minPower, liveData])

  const loading = liveLoading && !liveData
  const error = liveError
  const [selected, setSelected] = useState<Station | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const isAnalytics = isAnalyticsPath(pathname)
  const isTariffs = isTariffsPath(pathname)
  const activePage = getAppPage(pathname)

  const handleAddSlowLayerChange = useCallback((enabled: boolean) => {
    setAddSlowLayer(enabled)
    setSelected(null)
  }, [])

  const handleSelect = useCallback((station: Station | null) => {
    setSelected(station)
    if (station) setFiltersOpen(false)
  }, [])

  const activeFilterCount = countActiveFilters(filters, addSlowLayer)

  if (isAnalytics) {
    return (
      <AnalyticsPage
        liveStations={liveData?.stations ?? []}
        liveLoading={loading}
        liveDataSource={liveSource}
        updatedAt={liveData?.updatedAt ?? slowData?.updatedAt ?? null}
        lastFetchedAt={lastFetchedAt}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    )
  }

  if (isTariffs) {
    return (
      <TariffsPage
        theme={theme}
        onToggleTheme={toggleTheme}
        stations={mergedStations}
        loading={loading}
      />
    )
  }

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
        activePage={activePage}
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
            addSlowLayer={addSlowLayer}
            slowLoading={slowLoading}
            onAddSlowLayerChange={handleAddSlowLayerChange}
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
            {includeSlowData && (
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
          {includeSlowData && slowError && (
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

          {loading && !liveData && !isSlowOnlyPowerFilter(filters.minPower) && (
            <div className="map-overlay map-overlay--loading">
              <div className="spinner" />
              <p>Chargement des stations IRVE…</p>
            </div>
          )}

          {slowLoading && isSlowOnlyPowerFilter(filters.minPower) && !slowData && (
            <div className="map-overlay map-overlay--loading">
              <div className="spinner" />
              <p>Chargement des bornes lentes…</p>
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
