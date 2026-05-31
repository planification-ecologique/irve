import { useState } from 'react'
import type { Station } from '../types/irve'
import { getPowerBadgeClass } from '../lib/power'
import { CONNECTOR_TYPES, CONNECTOR_META, stationHasConnector } from '../lib/connectors'
import {
  getStoredNavigationProvider,
  openNavigationApp,
  persistNavigationProvider,
  type NavigationProvider,
} from '../lib/navigation'
import { NavigationPicker } from './NavigationPicker'
import {
  getAvailabilityTone,
  isFreeAccess,
  splitStationName,
} from '../lib/stationDisplay'
import { ConnectorIcon } from './ConnectorIcon'

interface StationDetailProps {
  station: Station
  onClose: () => void
}

export function StationDetail({ station, onClose }: StationDetailProps) {
  const { dynamic_summary: dynamic, summary } = station
  const powerClass = getPowerBadgeClass(summary.max_power)
  const { name, location } = splitStationName(station.nom_station)
  const availabilityTone = getAvailabilityTone(dynamic.available_count)
  const freeAccess = isFreeAccess(station.condition_acces)
  const [navPickerOpen, setNavPickerOpen] = useState(false)
  const [savedProvider, setSavedProvider] = useState(getStoredNavigationProvider)

  const openItinerary = (provider?: NavigationProvider) => {
    openNavigationApp(station.lat, station.lng, station.nom_station, provider)
  }

  const handleItineraryClick = () => {
    if (savedProvider) {
      openItinerary(savedProvider)
      return
    }
    setNavPickerOpen(true)
  }

  const handleNavProviderSelect = (provider: NavigationProvider) => {
    persistNavigationProvider(provider)
    setSavedProvider(provider)
    setNavPickerOpen(false)
    openItinerary(provider)
  }

  return (
    <aside className="station-detail">
      <button type="button" className="station-detail__close" onClick={onClose} aria-label="Fermer">
        ×
      </button>

      <header className="station-detail__header">
        <h2>{name}</h2>
        {location && <p className="station-detail__location">{location}</p>}
      </header>

      <p className="station-detail__operator">{station.nom_operateur}</p>

      <div className="station-detail__stats">
        <div className={`stat-card stat-card--power ${powerClass}`}>
          <span className="stat-card__value">{summary.max_power} kW</span>
          <span className="stat-card__label">Puissance max</span>
        </div>
        <div className={`stat-card stat-card--availability stat-card--availability-${availabilityTone}`}>
          <span className="stat-card__value">
            {dynamic.available_count} sur {station.pdc_count}
          </span>
          <span className="stat-card__label">PDC disponibles</span>
        </div>
      </div>

      <div className="station-detail__nav-block">
        {navPickerOpen ? (
          <NavigationPicker
            onSelect={handleNavProviderSelect}
            onCancel={() => setNavPickerOpen(false)}
          />
        ) : (
          <>
            <button
              type="button"
              className="station-detail__nav"
              onClick={handleItineraryClick}
            >
              Itinéraire
            </button>
            {savedProvider && (
              <button
                type="button"
                className="station-detail__nav-change"
                onClick={() => setNavPickerOpen(true)}
              >
                Changer d’app
              </button>
            )}
          </>
        )}
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

      <dl className="station-detail__meta station-detail__meta--compact">
        <div className="station-detail__meta-pair">
          <div>
            <dt>Accès</dt>
            <dd className={freeAccess ? undefined : 'station-detail__warn'}>
              {station.condition_acces}
            </dd>
          </div>
          <div>
            <dt>PMR</dt>
            <dd>{station.accessibilite_pmr}</dd>
          </div>
        </div>
        <div>
          <dt>Aménageur</dt>
          <dd>{station.nom_amenageur}</dd>
        </div>
      </dl>

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
