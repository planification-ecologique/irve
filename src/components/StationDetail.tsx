import type { Station } from '../types/irve'
import { getPowerBadgeClass, getPowerLabel } from '../lib/power'
import { CONNECTOR_TYPES, CONNECTOR_META, stationHasConnector } from '../lib/connectors'
import { ConnectorIcon } from './ConnectorIcon'

interface StationDetailProps {
  station: Station
  onClose: () => void
}

export function StationDetail({ station, onClose }: StationDetailProps) {
  const { dynamic_summary: dynamic, summary } = station
  const powerClass = getPowerBadgeClass(summary.max_power)

  return (
    <aside className="station-detail">
      <button type="button" className="station-detail__close" onClick={onClose} aria-label="Fermer">
        ×
      </button>

      <div className="station-detail__badge-row">
        <span className={`power-badge ${powerClass}`}>
          {summary.max_power} kW · {getPowerLabel(summary.max_power)}
        </span>
        {dynamic.available_count > 0 && (
          <span className="availability-badge availability-badge--available">
            {dynamic.available_count} dispo.
          </span>
        )}
      </div>

      <h2>{station.nom_station}</h2>

      <dl className="station-detail__meta">
        <div>
          <dt>Opérateur</dt>
          <dd>{station.nom_operateur}</dd>
        </div>
        <div>
          <dt>Aménageur</dt>
          <dd>{station.nom_amenageur}</dd>
        </div>
        <div>
          <dt>Accès</dt>
          <dd>{station.condition_acces}</dd>
        </div>
        <div>
          <dt>PMR</dt>
          <dd>{station.accessibilite_pmr}</dd>
        </div>
      </dl>

      <div className="station-detail__stats">
        <div className="stat-card">
          <span className="stat-card__value">{summary.max_power}</span>
          <span className="stat-card__label">kW max</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{station.pdc_count}</span>
          <span className="stat-card__label">Points de charge</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{dynamic.available_count}</span>
          <span className="stat-card__label">Disponibles</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{dynamic.occupied_count}</span>
          <span className="stat-card__label">Occupés</span>
        </div>
      </div>

      <div className="station-detail__connectors">
        <span className="section-label">Connecteurs</span>
        <div className="connector-badges">
          {CONNECTOR_TYPES.map((connector) => {
            const active = stationHasConnector(summary, connector)
            const meta = CONNECTOR_META[connector]

            return (
              <span
                key={connector}
                className={`connector-badge${active ? ' connector-badge--active' : ''}`}
                title={meta.label}
              >
                <ConnectorIcon type={connector} size={22} />
                <span>{meta.shortLabel}</span>
              </span>
            )
          })}
        </div>
      </div>

      {summary.pricing_headline && (
        <div className="station-detail__pricing">
          <span className="section-label">Tarification</span>
          <p>{summary.pricing_headline}</p>
        </div>
      )}

      <p className="station-detail__id">{station.id_station_itinerance}</p>
    </aside>
  )
}
