import { useEffect, useMemo, useState } from 'react'
import { searchPlaces, type GeocodedPlace } from '../api/geocoding'
import { useIrveData } from '../hooks/useIrveData'
import { useSavedTrips } from '../hooks/useSavedTrips'
import { useTheme } from '../hooks/useTheme'
import { buildSavedTrip, formatRouteDuration, tripLabel } from '../lib/buildTrip'
import {
  computeCoverageScore,
  computeTripChargeStops,
  buildStationLookup,
  resolveStationsOnRoute,
  tripChargeStopCount,
  type TripChargeStop,
} from '../lib/tripCoverage'
import { MIN_POWER_THRESHOLDS, POWER_LABELS } from '../lib/power'
import { computeTripPriceSummary } from '../lib/tripPricing'
import { TripStopCard } from './TripStopCard'
import { formatTariffPrice } from '../lib/tariffDisplay'
import { sumRouteAvailablePdc, sumRoutePdc } from '../lib/tripRouteDensity'
import type { Station } from '../types/irve'
import {
  COVERAGE_GRADE_LABELS,
  DEFAULT_CORRIDOR_KM,
  DEFAULT_TRIP_MIN_POWER_KW,
  DEFAULT_VEHICLE_RANGE_KM,
  type CoverageGrade,
  type SavedTrip,
} from '../types/trip'
import { IrveMap, type RouteOverlay } from './IrveMap'
import { TripRouteDensityChart } from './TripRouteDensityChart'
import { StatsBar } from './StatsBar'
import { StationDetail } from './StationDetail'
import { FeedbackForm } from './FeedbackForm'
import { FeedbackFab } from './FeedbackFab'
import '../App.css'
import '../Trips.css'

interface PlaceFieldProps {
  id: string
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  onSelect: (place: GeocodedPlace) => void
  disabled?: boolean
}

function PlaceField({
  id,
  label,
  value,
  placeholder,
  onChange,
  onSelect,
  disabled,
}: PlaceFieldProps) {
  const [suggestions, setSuggestions] = useState<GeocodedPlace[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (disabled || value.trim().length < 2) {
      setSuggestions([])
      return
    }

    const timer = window.setTimeout(() => {
      searchPlaces(value)
        .then((results) => {
          setSuggestions(results)
          setOpen(results.length > 0)
        })
        .catch(() => setSuggestions([]))
    }, 280)

    return () => window.clearTimeout(timer)
  }, [value, disabled])

  return (
    <div className="trips-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <ul className="trips-suggest" role="listbox">
          {suggestions.map((place) => (
            <li key={`${place.label}-${place.lat}`}>
              <button
                type="button"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(place.city)
                  onSelect(place)
                  setOpen(false)
                }}
              >
                {place.city}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function coverageClass(grade: CoverageGrade): string {
  return `trips-score trips-score--${grade}`
}

function TripCard({
  trip,
  active,
  score,
  grade,
  onSelect,
  onRemove,
}: {
  trip: SavedTrip
  active: boolean
  score?: number
  grade?: CoverageGrade
  onSelect: () => void
  onRemove: () => void
}) {
  const displayScore = score ?? trip.coverageScore
  const displayGrade = grade ?? trip.coverageGrade

  return (
    <article className={`trips-card${active ? ' trips-card--active' : ''}`}>
      <button type="button" className="trips-card__main" onClick={onSelect}>
        <div className="trips-card__head">
          <strong>{tripLabel(trip)}</strong>
          <span className={coverageClass(displayGrade)}>{displayScore}%</span>
        </div>
        <p className="trips-card__meta">
          {trip.routeDistanceKm.toLocaleString('fr-FR')} km · {trip.stationCount} stations · autonomie{' '}
          {trip.vehicleRangeKm} km
        </p>
        <p className="trips-card__grade">{COVERAGE_GRADE_LABELS[displayGrade]}</p>
      </button>
      <button
        type="button"
        className="trips-card__remove"
        aria-label={`Supprimer ${tripLabel(trip)}`}
        onClick={onRemove}
      >
        ×
      </button>
    </article>
  )
}

function formatDistanceKm(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR')} km`
}

export function TripsPage() {
  const { theme, toggleTheme } = useTheme()
  const { data, dataSource, lastFetchedAt, loading, error, refetch } = useIrveData()
  const stations = useMemo(() => data?.stations ?? [], [data?.stations])
  const stationLookup = useMemo(() => buildStationLookup(stations), [stations])
  const { trips, activeTrip, activeTripId, setActiveTripId, addTrip, removeTrip } = useSavedTrips()

  const [fromQuery, setFromQuery] = useState('')
  const [toQuery, setToQuery] = useState('')
  const [fromPlace, setFromPlace] = useState<GeocodedPlace | null>(null)
  const [toPlace, setToPlace] = useState<GeocodedPlace | null>(null)
  const [vehicleRangeKm, setVehicleRangeKm] = useState(DEFAULT_VEHICLE_RANGE_KM)
  const [minPowerKw, setMinPowerKw] = useState(DEFAULT_TRIP_MIN_POWER_KW)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Station | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [chartHoverKm, setChartHoverKm] = useState<number | null>(null)

  useEffect(() => {
    setChartHoverKm(null)
  }, [activeTrip?.id])

  const activeAnalysis = useMemo(() => {
    if (!activeTrip || stations.length === 0) return null

    const onRoute = resolveStationsOnRoute(
      stations,
      activeTrip.routeCoordinates,
      {
        corridorKm: activeTrip.corridorKm,
        minPowerKw: activeTrip.minPowerKw,
      },
      activeTrip.stationKeys,
      stationLookup,
    )
    const coverage = computeCoverageScore(
      activeTrip.routeDistanceKm,
      onRoute,
      activeTrip.vehicleRangeKm,
    )
    const pdcCount = sumRoutePdc(onRoute)
    const availablePdcCount = sumRouteAvailablePdc(onRoute)
    const priceSummary = computeTripPriceSummary(onRoute.map((item) => item.station))
    const chargeStops = computeTripChargeStops(
      activeTrip.routeDistanceKm,
      onRoute,
      activeTrip.vehicleRangeKm,
    )
    const stopCount = tripChargeStopCount(activeTrip.routeDistanceKm, activeTrip.vehicleRangeKm)
    const coveredStopCount = chargeStops.filter((stop) => stop.covered).length

    return { onRoute, coverage, pdcCount, availablePdcCount, priceSummary, chargeStops, stopCount, coveredStopCount }
  }, [activeTrip, stations, stationLookup])

  const routeStations = useMemo(
    () => activeAnalysis?.onRoute.map((item) => item.station) ?? [],
    [activeAnalysis],
  )

  const routeOverlay = useMemo<RouteOverlay | null>(() => {
    if (!activeTrip) return null
    return {
      coordinates: activeTrip.routeCoordinates,
      endpoints: {
        from: { ...activeTrip.from, label: activeTrip.from.label },
        to: { ...activeTrip.to, label: activeTrip.to.label },
      },
    }
  }, [activeTrip])

  const handleAddTrip = async () => {
    setFormError(null)
    if (!fromQuery.trim() || !toQuery.trim()) {
      setFormError('Indiquez un départ et une arrivée.')
      return
    }
    if (stations.length === 0) {
      setFormError('Stations IRVE non chargées.')
      return
    }

    setSubmitting(true)
    try {
      const trip = await buildSavedTrip(
        {
          fromQuery,
          toQuery,
          fromPlace,
          toPlace,
          vehicleRangeKm,
          minPowerKw,
          corridorKm: DEFAULT_CORRIDOR_KM,
        },
        stations,
      )
      addTrip(trip)
      setFromQuery('')
      setToQuery('')
      setFromPlace(null)
      setToPlace(null)
      setPanelOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Impossible de calculer le trajet.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app">
      <StatsBar
        stations={routeStations}
        availability="all"
        updatedAt={data?.updatedAt ?? null}
        lastFetchedAt={lastFetchedAt}
        loading={loading}
        dataSource={dataSource}
        theme={theme}
        onToggleTheme={toggleTheme}
        activePage="trips"
      />

      <main className="app__main app__main--trips">
        {panelOpen && (
          <button
            type="button"
            className="filters-backdrop"
            aria-label="Fermer le panneau trajets"
            onClick={() => setPanelOpen(false)}
          />
        )}

        <aside className={`sidebar trips-sidebar${panelOpen ? ' sidebar--open' : ''}`}>
          <div className="sidebar__handle" aria-hidden="true" />

          <div className="trips-panel">
            <header className="trips-panel__header">
              <h2>Trajets</h2>
              <p>Testez vos trajets habituels et la couverture IRVE le long de la route.</p>
            </header>

            <form
              className="trips-form"
              onSubmit={(event) => {
                event.preventDefault()
                void handleAddTrip()
              }}
            >
              <PlaceField
                id="trip-from"
                label="Départ"
                value={fromQuery}
                placeholder="Ex. Paris"
                disabled={submitting}
                onChange={(value) => {
                  setFromQuery(value)
                  setFromPlace(null)
                }}
                onSelect={setFromPlace}
              />
              <PlaceField
                id="trip-to"
                label="Arrivée"
                value={toQuery}
                placeholder="Ex. Lyon"
                disabled={submitting}
                onChange={(value) => {
                  setToQuery(value)
                  setToPlace(null)
                }}
                onSelect={setToPlace}
              />

              <div className="trips-field">
                <label htmlFor="trip-range">
                  Autonomie utile entre recharges
                  <span className="trips-field__hint">{vehicleRangeKm} km</span>
                </label>
                <input
                  id="trip-range"
                  type="range"
                  min={150}
                  max={600}
                  step={25}
                  value={vehicleRangeKm}
                  disabled={submitting}
                  onChange={(event) => setVehicleRangeKm(Number(event.target.value))}
                />
              </div>

              <div className="trips-field">
                <label htmlFor="trip-power">Puissance minimale</label>
                <select
                  id="trip-power"
                  value={minPowerKw}
                  disabled={submitting}
                  onChange={(event) => setMinPowerKw(Number(event.target.value))}
                >
                  {MIN_POWER_THRESHOLDS.map((threshold) => (
                    <option key={threshold} value={threshold}>
                      {POWER_LABELS[threshold]}
                    </option>
                  ))}
                </select>
              </div>

              {formError && <p className="trips-form__error">{formError}</p>}

              <button type="submit" className="trips-form__submit" disabled={submitting || loading}>
                {submitting ? 'Calcul…' : 'Ajouter le trajet'}
              </button>
            </form>

            {trips.length > 0 ? (
              <div className="trips-list">
                {trips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    active={trip.id === activeTripId}
                    score={
                      trip.id === activeTripId ? activeAnalysis?.coverage.score : undefined
                    }
                    grade={
                      trip.id === activeTripId ? activeAnalysis?.coverage.grade : undefined
                    }
                    onSelect={() => {
                      setActiveTripId(trip.id)
                      setSelected(null)
                      setPanelOpen(false)
                    }}
                    onRemove={() => removeTrip(trip.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="trips-empty">
                Aucun trajet enregistré. Les trajets sont conservés le temps de la session.
              </p>
            )}

            {activeTrip && activeAnalysis && (
              <section className="trips-detail" aria-live="polite">
                <h3>Détail</h3>
                <div className="trips-detail__score">
                  <span className={coverageClass(activeAnalysis.coverage.grade)}>
                    {activeAnalysis.coverage.score}%
                  </span>
                  <div>
                    <strong>{COVERAGE_GRADE_LABELS[activeAnalysis.coverage.grade]}</strong>
                    <p>
                      {activeAnalysis.stopCount === 0 ? (
                        <>
                          Trajet direct — recharge lente à l&apos;arrivée (autonomie{' '}
                          {activeTrip.vehicleRangeKm} km)
                        </>
                      ) : (
                        <>
                          {activeAnalysis.coveredStopCount}/{activeAnalysis.stopCount} arrêt
                          {activeAnalysis.stopCount > 1 ? 's' : ''} couvert
                          {activeAnalysis.coveredStopCount > 1 ? 's' : ''} · autonomie{' '}
                          {activeTrip.vehicleRangeKm} km
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <dl className="trips-detail__stats">
                  <div>
                    <dt>Distance</dt>
                    <dd>{formatDistanceKm(activeTrip.routeDistanceKm)}</dd>
                  </div>
                  <div>
                    <dt>Stations</dt>
                    <dd>{activeAnalysis.coverage.stationCount}</dd>
                  </div>
                  <div>
                    <dt>PDC</dt>
                    <dd>
                      {activeAnalysis.pdcCount.toLocaleString('fr-FR')}
                      {activeAnalysis.availablePdcCount > 0 && (
                        <span className="trips-detail__pdc-avail">
                          {' '}
                          ({activeAnalysis.availablePdcCount.toLocaleString('fr-FR')} dispo)
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Intervalle max</dt>
                    <dd>{formatDistanceKm(activeAnalysis.coverage.maxGapKm)}</dd>
                  </div>
                  <div>
                    <dt>Durée</dt>
                    <dd>{formatRouteDuration(activeTrip.routeDurationMinutes)}</dd>
                  </div>
                  <div>
                    <dt>Prix moyen</dt>
                    <dd>
                      {activeAnalysis.priceSummary.avgPricePerKwh != null
                        ? formatTariffPrice(
                            activeAnalysis.priceSummary.avgPricePerKwh,
                            '€/kWh',
                          )
                        : '—'}
                    </dd>
                  </div>
                </dl>
                <TripStopZonesList stops={activeAnalysis.chargeStops} />
              </section>
            )}
          </div>

          <button
            type="button"
            className="sidebar__close-mobile"
            onClick={() => setPanelOpen(false)}
          >
            Fermer
          </button>
        </aside>

        <div className="map-shell trips-map-shell">
          <button
            type="button"
            className={`trips-toggle${trips.length > 0 ? ' trips-toggle--active' : ''}`}
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((open) => !open)}
          >
            Trajets
            {trips.length > 0 && (
              <span className="trips-toggle__badge">{trips.length}</span>
            )}
          </button>
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

          <div className="trips-map-shell__map">
            {!activeTrip && !loading && (
              <div className="map-overlay map-overlay--hint">
                <div className="trips-hint">
                  <p>Ajoutez un trajet pour afficher la route et les stations associées.</p>
                  <button
                    type="button"
                    className="trips-hint__cta"
                    onClick={() => setPanelOpen(true)}
                  >
                    Ajouter un trajet
                  </button>
                </div>
              </div>
            )}

            {data && (
              <IrveMap
                stations={routeStations}
                selectedKey={selected?.station_key ?? null}
                onSelect={setSelected}
                theme={theme}
                routeOverlay={routeOverlay}
                routeHighlightKm={chartHoverKm}
                disableCluster
              />
            )}

            {selected && (
              <StationDetail station={selected} onClose={() => setSelected(null)} />
            )}

            <FeedbackFab onClick={() => setFeedbackOpen(true)} />
          </div>

          {activeTrip && activeAnalysis && (
            <TripRouteDensityChart
              fromLabel={activeTrip.from.label}
              toLabel={activeTrip.to.label}
              routeLengthKm={activeTrip.routeDistanceKm}
              vehicleRangeKm={activeTrip.vehicleRangeKm}
              stations={activeAnalysis.onRoute}
              onHoverKmChange={setChartHoverKm}
            />
          )}

          {!activeTrip && !loading && (
            <section className="trips-preview" aria-label="Aperçu des résultats">
              <h3 className="trips-preview__title">Aperçu</h3>
              <ul className="trips-preview__list">
                <li>Route et stations (corridor 15 km)</li>
                <li>Arrêts recharge rapide estimés</li>
                <li>Couverture et prix le long du trajet</li>
              </ul>
              <button
                type="button"
                className="trips-preview__cta"
                onClick={() => setPanelOpen(true)}
              >
                Ajouter un trajet
              </button>
            </section>
          )}
        </div>
      </main>

      {feedbackOpen && <FeedbackForm onClose={() => setFeedbackOpen(false)} />}
    </div>
  )
}

function TripStopZonesList({ stops }: { stops: TripChargeStop[] }) {
  if (stops.length === 0) {
    return null
  }

  return (
    <div className="trips-stop-zones">
      <div className="trips-stop-zones__cards">
        {stops.map((stop) => (
          <TripStopCard key={stop.index} stop={stop} />
        ))}
      </div>
      {stops.map((stop) => {
        const zoneStations = [...(stop.likelyStop?.stations ?? [])].sort((a, b) => {
          const pdcDiff = b.station.pdc_count - a.station.pdc_count
          if (pdcDiff !== 0) return pdcDiff
          return a.distanceAlongRouteKm - b.distanceAlongRouteKm
        })

        if (zoneStations.length === 0) return null

        return (
          <ol key={`stations-${stop.index}`} className="trips-stops" aria-label={`Stations arrêt ${stop.index}`}>
            {zoneStations.map((item) => (
              <li key={item.station.station_key}>
                {Math.round(item.distanceAlongRouteKm).toLocaleString('fr-FR')} km ·{' '}
                <strong>{item.station.nom_station}</strong> · {item.station.summary.max_power} kW ·{' '}
                {item.station.dynamic_summary.available_count}/{item.station.pdc_count} dispo
              </li>
            ))}
          </ol>
        )
      })}
    </div>
  )
}
