import type { Station } from '../types/irve'
import type { AvailabilityFilter } from '../lib/stations'

interface StatsBarProps {
  stations: Station[]
  availability: AvailabilityFilter
  updatedAt: string | null
  loading: boolean
}

export function StatsBar({ stations, availability, updatedAt, loading }: StatsBarProps) {
  const totalPdc = stations.reduce((sum, station) => sum + station.pdc_count, 0)
  const availablePdc = stations.reduce(
    (sum, station) => sum + station.dynamic_summary.available_count,
    0,
  )
  const occupiedPdc = stations.reduce(
    (sum, station) => sum + station.dynamic_summary.occupied_count,
    0,
  )
  const ultraCount = stations.filter((s) => s.summary.max_power >= 150).length

  const updatedLabel = updatedAt
    ? new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(updatedAt))
    : '—'

  const format = (value: number) =>
    loading ? '…' : value.toLocaleString('fr-FR')

  return (
    <header className="stats-bar">
      <div className="stats-bar__brand">
        <div className="stats-bar__logo">⚡</div>
        <div>
          <h1>Carte IRVE</h1>
          <p>Infrastructure de recharge électrique — France</p>
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
              <span className="metric__value metric__value--warn">
                {format(occupiedPdc)}
              </span>
              <span className="metric__label">Occupées</span>
            </div>
          </>
        )}

        <div className="metric">
          <span className="metric__value">{format(ultraCount)}</span>
          <span className="metric__label">Ultra-rapides</span>
        </div>
      </div>

      <div className="stats-bar__updated">
        <span>Màj</span>
        <strong>{loading ? '…' : updatedLabel}</strong>
      </div>
    </header>
  )
}
