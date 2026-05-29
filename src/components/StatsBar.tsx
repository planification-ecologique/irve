import type { Station } from '../types/irve'

interface StatsBarProps {
  stations: Station[]
  updatedAt: string | null
  loading: boolean
}

export function StatsBar({ stations, updatedAt, loading }: StatsBarProps) {
  const totalPdc = stations.reduce((sum, station) => sum + station.pdc_count, 0)
  const availablePdc = stations.reduce(
    (sum, station) => sum + station.dynamic_summary.available_count,
    0,
  )
  const ultraCount = stations.filter((s) => s.summary.max_power >= 150).length

  const updatedLabel = updatedAt
    ? new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(updatedAt))
    : '—'

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
          <span className="metric__value">
            {loading ? '…' : stations.length.toLocaleString('fr-FR')}
          </span>
          <span className="metric__label">Stations</span>
        </div>
        <div className="metric">
          <span className="metric__value">
            {loading ? '…' : totalPdc.toLocaleString('fr-FR')}
          </span>
          <span className="metric__label">Points de charge</span>
        </div>
        <div className="metric">
          <span className="metric__value metric__value--accent">
            {loading ? '…' : availablePdc.toLocaleString('fr-FR')}
          </span>
          <span className="metric__label">Disponibles</span>
        </div>
        <div className="metric">
          <span className="metric__value">
            {loading ? '…' : ultraCount.toLocaleString('fr-FR')}
          </span>
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
