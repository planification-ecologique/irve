import { useEffect, useRef, useState } from 'react'
import type { Station } from '../types/irve'
import { isStaticStation } from '../lib/stationOrigin'
import { formatMaxPowerKw } from '../lib/formatPower'
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
import { useStationDetail } from '../hooks/useStationDetail'
import {
  getAvailabilityTone,
  formatStationCopyText,
  formatStationAddress,
  isFreeAccess,
  splitStationName,
} from '../lib/stationDisplay'
import {
  formatConnectorAvailability,
  getConnectorAvailabilityTone,
  summarizeConnectorAvailability,
} from '../lib/pdcAvailability'
import { formatOperatorPhone, formatPaymentMethods } from '../lib/stationDetailDisplay'
import { ConnectorIcon } from './ConnectorIcon'

interface StationDetailProps {
  station: Station
  onClose: () => void
}

export function StationDetail({ station, onClose }: StationDetailProps) {
  const staticOnly = isStaticStation(station)
  const { dynamic_summary: dynamic, summary } = station
  const powerClass = getPowerBadgeClass(summary.max_power)
  const { name, location } = splitStationName(station.nom_station)
  const availabilityTone = getAvailabilityTone(dynamic.available_count)
  const freeAccess = isFreeAccess(station.condition_acces)
  const [navPickerOpen, setNavPickerOpen] = useState(false)
  const [savedProvider, setSavedProvider] = useState(getStoredNavigationProvider)
  const [copied, setCopied] = useState(false)
  const navAppRef = useRef<HTMLDivElement>(null)
  const { detail, loading: detailLoading } = useStationDetail(
    station.id_station_itinerance,
    !staticOnly,
  )
  const formattedAddress = detail ? formatStationAddress(detail) : null
  const connectorAvailability = detail?.pdcs ? summarizeConnectorAvailability(detail.pdcs) : []
  const connectorAvailabilityByType = new Map(
    connectorAvailability.map((entry) => [entry.type, entry]),
  )
  const paymentMethods = detail ? formatPaymentMethods(detail) : null
  const operatorPhone = detail ? formatOperatorPhone(detail.telephone_operateur) : null
  const copyLabel = formattedAddress ? "Copier l'adresse" : 'Copier les coordonnées'
  const copiedLabel = formattedAddress ? 'Adresse copiée' : 'Coordonnées copiées'

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

  const handleCopyLocation = async () => {
    const text = formatStationCopyText(station.lat, station.lng, detail)

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
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
        {formattedAddress ? (
          <p className="station-detail__address">{formattedAddress}</p>
        ) : detailLoading ? (
          <p className="station-detail__address station-detail__address--loading">Chargement de l’adresse…</p>
        ) : null}
      </header>

      <p className="station-detail__operator">{station.nom_operateur}</p>

      <div className="station-detail__stats">
        <div className={`stat-card stat-card--power ${powerClass}`}>
          <span className="stat-card__value">{formatMaxPowerKw(summary.max_power)}</span>
          <span className="stat-card__label">Puissance max</span>
        </div>
        {!staticOnly ? (
          <div className={`stat-card stat-card--availability stat-card--availability-${availabilityTone}`}>
            <span className="stat-card__value">
              {dynamic.available_count} sur {station.pdc_count}
            </span>
            <span className="stat-card__label">PDC disponibles</span>
          </div>
        ) : (
          <div className="stat-card stat-card--availability stat-card--availability-nc">
            <span className="stat-card__value">NC</span>
            <span className="stat-card__label">Dispo</span>
          </div>
        )}
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
            onClick={handleCopyLocation}
            aria-label={copied ? copiedLabel : copyLabel}
            title={copied ? copiedLabel : copyLabel}
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
            const availability = connectorAvailabilityByType.get(connector)
            const availabilityTone = availability
              ? getConnectorAvailabilityTone(availability)
              : null

            if (!active) return null

            return (
              <span
                key={connector}
                className={`connector-badge connector-badge--active${
                  availabilityTone ? ` connector-badge--${availabilityTone}` : ''
                }`}
                title={
                  availability
                    ? `${meta.label} · ${formatConnectorAvailability(availability)} · ${availability.maxPowerKw} kW`
                    : meta.label
                }
              >
                <ConnectorIcon type={connector} size={22} />
                <span className="connector-badge__copy">
                  <span className="connector-badge__label">{meta.shortLabel}</span>
                  {availability && (
                    <span className="connector-badge__status">
                      {formatConnectorAvailability(availability)}
                    </span>
                  )}
                  {!availability && detailLoading && (
                    <span className="connector-badge__status connector-badge__status--loading">
                      …
                    </span>
                  )}
                </span>
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
        {(detail?.implantation_station || detail?.horaires) && (
          <div className="station-detail__meta-pair">
            {detail.implantation_station && (
              <div>
                <dt>Implantation</dt>
                <dd>{detail.implantation_station}</dd>
              </div>
            )}
            {detail.horaires && (
              <div>
                <dt>Horaires</dt>
                <dd>{detail.horaires}</dd>
              </div>
            )}
          </div>
        )}
        {(paymentMethods || operatorPhone) && (
          <div className="station-detail__meta-pair">
            {paymentMethods && (
              <div>
                <dt>Paiement</dt>
                <dd>{paymentMethods}</dd>
              </div>
            )}
            {operatorPhone && (
              <div>
                <dt>Contact</dt>
                <dd>
                  <a href={`tel:${operatorPhone.replace(/\s/g, '')}`}>{operatorPhone}</a>
                </dd>
              </div>
            )}
          </div>
        )}
        {detail?.restriction_gabarit && detail.restriction_gabarit !== 'Aucune Restriction' && (
          <div>
            <dt>Gabarit</dt>
            <dd>{detail.restriction_gabarit}</dd>
          </div>
        )}
        {detail?.cable_t2_attache && (
          <div>
            <dt>Câble Type 2</dt>
            <dd>Attaché sur place</dd>
          </div>
        )}
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
