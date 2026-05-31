import { useEffect, useState } from 'react'
import { POLL_INTERVAL_MINUTES, type IrveDataSource } from '../api/irve'
import { formatRelativeMinutes } from '../lib/time'
import type { Theme } from '../lib/theme'
import type { Station } from '../types/irve'
import type { AvailabilityFilter } from '../lib/stations'
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
}: StatsBarProps) {
  const [, setNowTick] = useState(0)

  useEffect(() => {
    if (dataSource !== 'live' || !lastFetchedAt) return

    let intervalId: ReturnType<typeof window.setInterval> | undefined

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

  const totalPdc = stations.reduce((sum, station) => sum + station.pdc_count, 0)
  const availablePdc = stations.reduce(
    (sum, station) => sum + station.dynamic_summary.available_count,
    0,
  )
  const occupiedPdc = stations.reduce(
    (sum, station) => sum + station.dynamic_summary.occupied_count,
    0,
  )
  const outOfServicePdc = stations.reduce(
    (sum, station) => sum + Math.max(0, station.pdc_count - station.dynamic_summary.en_service_count),
    0,
  )
  const ultraCount = stations.filter((s) => s.summary.max_power >= 150).length

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
        <div className="stats-bar__logo">⚡</div>
        <div>
          <h1>Carto IRVE</h1>
          <p>Infrastructure de recharge électrique en itiniérance — France</p>
        </div>
      </div>

      <div className="stats-bar__metrics">
        <div className="metric">
          <span className="metric__value">{format(stations.length)}</span>
          <span className="metric__label">Stations</span>
        </div>

        {availability === 'all' && (
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

        {availability === 'available' && (
          <div className="metric">
            <span className="metric__value metric__value--accent">
              {format(availablePdc)}
            </span>
            <span className="metric__label">Prises disponibles</span>
          </div>
        )}

        {availability === 'full' && (
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

        {availability === 'out_of_service' && (
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

        <div className="metric">
          <span className="metric__value">{format(ultraCount)}</span>
          <span className="metric__label">Ultra-rapides</span>
        </div>
      </div>

      <div className="stats-bar__actions">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />

        <div className="stats-bar__updated">
          {dataSource === 'live' ? (
            <>
              <span
                className="stats-bar__live"
                title={`Rafraîchissement automatique toutes les ${POLL_INTERVAL_MINUTES} minutes`}
              >
                <span className="stats-bar__live-dot" aria-hidden="true" />
                Live
              </span>
              <strong>maj {liveLabel}</strong>
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
