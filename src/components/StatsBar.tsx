import { useEffect, useState } from 'react'
import { POLL_INTERVAL_MINUTES, type IrveDataSource } from '../api/irve'
import { formatRelativeMinutes } from '../lib/time'
import type { Theme } from '../lib/theme'
import type { Station } from '../types/irve'
import { isStaticStation } from '../lib/stationOrigin'
import type { AvailabilityFilter } from '../lib/stations'
import type { AppPage } from '../lib/routes'
import { AppNav } from './AppNav'
import { ThemeToggle } from './ThemeToggle'

interface StatsBarProps {
  stations: Station[]
  availability: AvailabilityFilter
  updatedAt: string | null
  lastFetchedAt: Date | null
  loading: boolean
  dataSource: IrveDataSource | null
  theme: Theme
  onToggleTheme: () => void
  activePage?: AppPage
}

export function StatsBar({
  stations,
  availability,
  updatedAt,
  lastFetchedAt,
  loading,
  dataSource,
  theme,
  onToggleTheme,
  activePage = 'map',
}: StatsBarProps) {
  const [, setNowTick] = useState(0)

  useEffect(() => {
    if ((dataSource !== 'live' && dataSource !== 'mixed') || !lastFetchedAt) return

    let intervalId: number | undefined

    const stop = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
        intervalId = undefined
      }
    }

    const start = () => {
      stop()
      if (document.visibilityState !== 'visible') return
      intervalId = window.setInterval(() => {
        setNowTick((value) => value + 1)
      }, 60_000)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') start()
      else stop()
    }

    start()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [dataSource, lastFetchedAt])

  const liveStations = stations.filter((station) => !isStaticStation(station))
  const staticStations = stations.filter((station) => isStaticStation(station))
  const hasLive = liveStations.length > 0

  const totalPdc = liveStations.reduce((sum, station) => sum + station.pdc_count, 0)
  const staticPdc = staticStations.reduce((sum, station) => sum + station.pdc_count, 0)
  const availablePdc = liveStations.reduce(
    (sum, station) => sum + station.dynamic_summary.available_count,
    0,
  )
  const occupiedPdc = liveStations.reduce(
    (sum, station) => sum + station.dynamic_summary.occupied_count,
    0,
  )
  const outOfServicePdc = liveStations.reduce(
    (sum, station) => sum + Math.max(0, station.pdc_count - station.dynamic_summary.en_service_count),
    0,
  )
  const ultraCount = liveStations.filter((s) => s.summary.max_power >= 150).length

  const snapshotLabel = updatedAt
    ? new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(updatedAt))
    : '—'

  const format = (value: number) =>
    loading ? '…' : value.toLocaleString('fr-FR')

  const liveLabel =
    lastFetchedAt && !loading
      ? formatRelativeMinutes(lastFetchedAt)
      : '…'

  return (
    <header className="stats-bar">
      <div className="stats-bar__brand">
        <img
          src="/logo-electrifions.svg"
          alt="Électrifions la France"
          className="stats-bar__logo"
        />
        <div className="stats-bar__identity">
          <h1>Recharger en itinérance</h1>
          <p>Données ouvertes - recharge électrique en itinérance (&gt;50 kW)</p>
          <AppNav active={activePage} />
        </div>
      </div>

      <div className="stats-bar__metrics">
        <div className="metric">
          <span className="metric__value">{format(stations.length)}</span>
          <span className="metric__label">Stations</span>
        </div>

        {availability === 'all' && hasLive && (
          <>
            <div className="metric">
              <span className="metric__value">{format(totalPdc)}</span>
              <span className="metric__label">Points de charge</span>
            </div>
            <div className="metric">
              <span className="metric__value metric__value--accent">
                {format(availablePdc)}
              </span>
              <span className="metric__label">Disponibles</span>
            </div>
          </>
        )}

        {availability === 'all' && staticStations.length > 0 && (
          <div className="metric">
            <span className="metric__value">{format(staticPdc)}</span>
            <span className="metric__label">PDC &lt; 50 kW</span>
          </div>
        )}

        {availability === 'available' && hasLive && (
          <div className="metric">
            <span className="metric__value metric__value--accent">
              {format(availablePdc)}
            </span>
            <span className="metric__label">Prises disponibles</span>
          </div>
        )}

        {availability === 'full' && hasLive && (
          <>
            <div className="metric">
              <span className="metric__value">{format(totalPdc)}</span>
              <span className="metric__label">Prises (total)</span>
            </div>
            <div className="metric">
              <span className="metric__value metric__value--danger">
                {format(occupiedPdc)}
              </span>
              <span className="metric__label">Occupées</span>
            </div>
          </>
        )}

        {availability === 'out_of_service' && hasLive && (
          <>
            <div className="metric">
              <span className="metric__value">{format(totalPdc)}</span>
              <span className="metric__label">Prises (total)</span>
            </div>
            <div className="metric">
              <span className="metric__value metric__value--muted">
                {format(outOfServicePdc)}
              </span>
              <span className="metric__label">Hors service</span>
            </div>
          </>
        )}

        {hasLive && (
          <div className="metric">
            <span className="metric__value">{format(ultraCount)}</span>
            <span className="metric__label">Ultra-rapides</span>
          </div>
        )}
      </div>

      <div className="stats-bar__actions">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />

        <div className="stats-bar__updated">
          {dataSource === 'live' || dataSource === 'mixed' ? (
            <>
              <span
                className="stats-bar__live"
                title={`Rafraîchissement automatique toutes les ${POLL_INTERVAL_MINUTES} minutes`}
              >
                <span className="stats-bar__live-dot" aria-hidden="true" />
                Live
              </span>
              {dataSource === 'mixed' && staticStations.length > 0 && (
                <span className="stats-bar__stale" title="Couche statique sans dispo temps réel">
                  + &lt; 50 kW
                </span>
              )}
              <strong>maj {liveLabel}</strong>
            </>
          ) : dataSource === 'transport-slow' ? (
            <>
              <span
                className="stats-bar__stale"
                title="Consolidation statique transport.data.gouv.fr (sans disponibilité temps réel)."
              >
                Statique
              </span>
              <span>Màj</span>
              <strong>{loading ? '…' : snapshotLabel}</strong>
            </>
          ) : (
            <>
              {dataSource === 'fallback' && (
                <span
                  className="stats-bar__stale"
                  title="L’API QualiCharge est indisponible. Affichage d’un snapshot figé au dernier déploiement."
                >
                  Données non live
                </span>
              )}
              <span>Màj</span>
              <strong>{loading ? '…' : snapshotLabel}</strong>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
