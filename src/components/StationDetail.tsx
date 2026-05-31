import { useEffect, useRef, useState } from 'react'
import type { Station } from '../types/irve'
import { getPowerBadgeClass } from '../lib/power'
import { CONNECTOR_TYPES, CONNECTOR_META, stationHasConnector } from '../lib/connectors'
import {
  getNavigationProviderLabel,
  getStoredNavigationProvider,
  openNavigationApp,
  persistNavigationProvider,
  type NavigationProvider,
} from '../lib/navigation'
import { NavigationPicker } from './NavigationPicker'
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  NavigationProviderIcon,
  RouteIcon,
} from './NavigationIcons'
import {
  getAvailabilityTone,
  getStationAddress,
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
  const [copied, setCopied] = useState(false)
  const navAppRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!navPickerOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!navAppRef.current?.contains(event.target as Node)) {
        setNavPickerOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [navPickerOpen])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const openItinerary = (provider?: NavigationProvider) => {
    openNavigationApp(station.lat, station.lng, station.nom_station, provider)
  }

  const handleItineraryClick = () => {
    openItinerary(savedProvider ?? 'default')
  }

  const handleNavProviderSelect = (provider: NavigationProvider) => {
    persistNavigationProvider(provider)
    setSavedProvider(provider)
    setNavPickerOpen(false)
  }

  const handleCopyAddress = async () => {
    const address = getStationAddress(station.nom_station)

    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
    } catch {
      // fallback si clipboard API indisponible
      const textarea = document.createElement('textarea')
      textarea.value = address
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
    }
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
        <div className="station-detail__nav-row">
          <button
            type="button"
            className="station-detail__nav-btn station-detail__nav-btn--route"
            onClick={handleItineraryClick}
            aria-label="Itinéraire"
            title="Itinéraire"
          >
            <RouteIcon />
            <span>Itinéraire</span>
          </button>

          <div className="station-detail__nav-app" ref={navAppRef}>
            <button
              type="button"
              className="station-detail__nav-btn station-detail__nav-btn--app"
              aria-expanded={navPickerOpen}
              aria-haspopup="listbox"
              aria-label={`Application de navigation : ${getNavigationProviderLabel(savedProvider)}`}
              title={getNavigationProviderLabel(savedProvider)}
              onClick={() => setNavPickerOpen((open) => !open)}
            >
              <NavigationProviderIcon provider={savedProvider ?? 'default'} />
              <ChevronDownIcon />
            </button>
            {navPickerOpen && (
              <NavigationPicker selected={savedProvider} onSelect={handleNavProviderSelect} />
            )}
          </div>

          <button
            type="button"
            className={`station-detail__nav-btn station-detail__nav-btn--copy${copied ? ' station-detail__nav-btn--copied' : ''}`}
            onClick={handleCopyAddress}
            aria-label={copied ? 'Adresse copiée' : "Copier l'adresse"}
            title={copied ? 'Adresse copiée' : "Copier l'adresse"}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
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
