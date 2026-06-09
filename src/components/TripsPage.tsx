import { useEffect, useMemo, useState } from 'react'
import { searchPlaces, type GeocodedPlace } from '../api/geocoding'
import { useIrveData } from '../hooks/useIrveData'
import { useSavedTrips } from '../hooks/useSavedTrips'
import { useTheme } from '../hooks/useTheme'
import { buildSavedTrip, tripLabel } from '../lib/buildTrip'
import {
  computeCoverageScore,
  buildStationLookup,
  resolveStationsOnRoute,
  type StationOnRoute,
} from '../lib/tripCoverage'
import { MIN_POWER_THRESHOLDS, POWER_LABELS } from '../lib/power'
import { computeTripPriceSummary } from '../lib/tripPricing'
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

    return { onRoute, coverage, pdcCount, availablePdcCount, priceSummary }
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
                <h3>Détail du trajet</h3>
                <div className="trips-detail__score">
                  <span className={coverageClass(activeAnalysis.coverage.grade)}>
                    {activeAnalysis.coverage.score}%
                  </span>
                  <div>
                    <strong>{COVERAGE_GRADE_LABELS[activeAnalysis.coverage.grade]}</strong>
                    <p>
                      {activeAnalysis.coverage.coveredSegmentCount}/
                      {activeAnalysis.coverage.segmentCount} tronçons couverts (autonomie{' '}
                      {activeTrip.vehicleRangeKm} km)
                    </p>
                  </div>
                </div>
                <dl className="trips-detail__stats">
                  <div>
                    <dt>Distance route</dt>
                    <dd>{formatDistanceKm(activeTrip.routeDistanceKm)}</dd>
                  </div>
                  <div>
                    <dt>Stations sur trajet</dt>
                    <dd>{activeAnalysis.coverage.stationCount}</dd>
                  </div>
                  <div>
                    <dt>Points de charge</dt>
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
                    <dt>Plus grand intervalle</dt>
                    <dd>{formatDistanceKm(activeAnalysis.coverage.maxGapKm)}</dd>
                  </div>
                  <div>
                    <dt>Durée route</dt>
                    <dd>{activeTrip.routeDurationMinutes} min</dd>
                  </div>
                  <div className="trips-detail__stat--wide">
                    <dt>Prix moyen (CB direct)</dt>
                    <dd>
                      {activeAnalysis.priceSummary.avgPricePerKwh != null ? (
                        <>
                          ≈{' '}
                          {formatTariffPrice(activeAnalysis.priceSummary.avgPricePerKwh, '€/kWh')}
                          {activeAnalysis.priceSummary.minPricePerKwh != null &&
                            activeAnalysis.priceSummary.maxPricePerKwh != null &&
                            activeAnalysis.priceSummary.minPricePerKwh !==
                              activeAnalysis.priceSummary.maxPricePerKwh && (
                              <span className="trips-detail__price-range">
                                {' '}
                                ·{' '}
                                {formatTariffPrice(
                                  activeAnalysis.priceSummary.minPricePerKwh,
                                  '€/kWh',
                                )}
                                {' – '}
                                {formatTariffPrice(
                                  activeAnalysis.priceSummary.maxPricePerKwh,
                                  '€/kWh',
                                )}
                              </span>
                            )}
                        </>
                      ) : (
                        '—'
                      )}
                    </dd>
                    {activeAnalysis.priceSummary.avgPricePerKwh != null && (
                      <p className="trips-detail__price-note">
                        {activeAnalysis.priceSummary.coveragePct}% des PDC tarifés (
                        {activeAnalysis.priceSummary.pricedPdcCount.toLocaleString('fr-FR')}/
                        {activeAnalysis.priceSummary.totalPdcCount.toLocaleString('fr-FR')}) ·
                        grilles opérateurs, accès direct
                      </p>
                    )}
                  </div>
                </dl>
                <TripStopsList items={activeAnalysis.onRoute} />
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
                <p>Ajoutez un trajet pour afficher la route et les stations associées.</p>
              </div>
            )}

            {data && (
              <IrveMap
                stations={routeStations}
                selectedKey={selected?.station_key ?? null}
                onSelect={setSelected}
                theme={theme}
                routeOverlay={routeOverlay}
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
            />
          )}
        </div>
      </main>

      {feedbackOpen && <FeedbackForm onClose={() => setFeedbackOpen(false)} />}
    </div>
  )
}

function TripStopsList({ items }: { items: StationOnRoute[] }) {
  if (items.length === 0) {
    return <p className="trips-stops__empty">Aucune station ne correspond aux critères sur ce trajet.</p>
  }

  return (
    <ol className="trips-stops">
      {items.map((item) => (
        <li key={item.station.station_key}>
          <span className="trips-stops__km">
            {Math.round(item.distanceAlongRouteKm).toLocaleString('fr-FR')} km
          </span>
          <div>
            <strong>{item.station.nom_station}</strong>
            <span>
              {item.station.nom_operateur} · {item.station.summary.max_power} kW ·{' '}
              {item.station.dynamic_summary.available_count}/{item.station.pdc_count} dispo
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}
