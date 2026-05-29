import { useCallback, useState } from 'react'
import { useIrveData } from './hooks/useIrveData'
import { useFilteredStations } from './components/FiltersPanel'
import { IrveMap } from './components/IrveMap'
import { StatsBar } from './components/StatsBar'
import { FiltersPanel } from './components/FiltersPanel'
import { StationDetail } from './components/StationDetail'
import type { Station } from './types/irve'
import './App.css'

function App() {
  const { data, loading, error, refetch } = useIrveData()
  const { filters, setFilters, filtered } = useFilteredStations(data?.stations)
  const [selected, setSelected] = useState<Station | null>(null)

  const handleSelect = useCallback((station: Station | null) => {
    setSelected(station)
  }, [])

  return (
    <div className="app">
      <StatsBar
        stations={filtered}
        updatedAt={data?.updatedAt ?? null}
        loading={loading}
      />

      <main className="app__main">
        <aside className="sidebar">
          <FiltersPanel
            filters={filters}
            onChange={setFilters}
            totalCount={data?.stations.length ?? 0}
            filteredCount={filtered.length}
          />

          <p className="sidebar__source">
            Données{' '}
            <a
              href="https://qualicharge-carto.osc-fr1.scalingo.io/api/irve/points/"
              target="_blank"
              rel="noreferrer"
            >
              QualiCharge
            </a>
          </p>
        </aside>

        <div className="map-shell">
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
