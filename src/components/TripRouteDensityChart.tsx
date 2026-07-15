import { useCallback, useMemo, useState } from 'react'
import { formatTripCityLabel } from '../lib/buildTrip'
import { computeTripSegmentMinPrices, formatCompactPricePerKwh } from '../lib/tripPricing'
import { TripStopCard } from './TripStopCard'
import { tripRangeBands } from '../lib/tripSegments'
import { type TripChargeStop, type StationOnRoute } from '../lib/tripCoverage'
import {
  buildSvgLinePath,
  buildSvgLinePathsWithGaps,
  computeRollingRouteDensity,
  computeRouteGapBands,
  computeSparseRouteBands,
  formatPriceAxisTick,
  isDensityValueCapped,
  MAX_DENSITY_BIN_SCALE,
  rollingWindowKm,
  routeDensityScaleMax,
  routeDensityTicks,
  routeDensityValueHeight,
  routeGapWarningKm,
  routePriceScale,
  routePriceY,
  sumRouteAvailablePdc,
  sumRoutePdc,
  type RouteDensitySample,
} from '../lib/tripRouteDensity'

interface TripRouteDensityChartProps {
  fromLabel: string
  toLabel: string
  routeLengthKm: number
  vehicleRangeKm: number
  stations: StationOnRoute[]
  chargeStops: TripChargeStop[]
  onHoverKmChange?: (km: number | null) => void
}

const CHART_WIDTH = 960
const CHART_HEIGHT = 168
const PAD_LEFT = 36
const PAD_RIGHT = 40
const PAD_TOP = 16
const PAD_BOTTOM = 30
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM
const STOP_LABEL_Y = PAD_TOP + PLOT_HEIGHT - 5

export function TripRouteDensityChart({
  fromLabel,
  toLabel,
  routeLengthKm,
  vehicleRangeKm,
  stations,
  chargeStops,
  onHoverKmChange,
}: TripRouteDensityChartProps) {
  const [hovered, setHovered] = useState<RouteDensitySample | null>(null)
  const plotWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT
  const safeLength = Math.max(routeLengthKm, 1)
  const windowKm = rollingWindowKm(routeLengthKm)
  const gapWarningKm = routeGapWarningKm(vehicleRangeKm)
  const { totalPdc, totalAvailablePdc } = useMemo(
    () => ({
      totalPdc: sumRoutePdc(stations),
      totalAvailablePdc: sumRouteAvailablePdc(stations),
    }),
    [stations],
  )

  const samples = useMemo(
    () => computeRollingRouteDensity(routeLengthKm, stations, windowKm),
    [routeLengthKm, stations, windowKm],
  )

  const stationScaleMax = useMemo(
    () => routeDensityScaleMax(samples.map((sample) => sample.stationCount)),
    [samples],
  )
  const pdcScaleMax = useMemo(
    () => routeDensityScaleMax(samples.map((sample) => Math.ceil(sample.pdcCount / 3))),
    [samples],
  )
  const hasCappedStationValues = useMemo(
    () => samples.some((sample) => isDensityValueCapped(sample.stationCount, stationScaleMax)),
    [samples, stationScaleMax],
  )
  const gapBands = useMemo(
    () => computeRouteGapBands(routeLengthKm, stations, gapWarningKm),
    [routeLengthKm, stations, gapWarningKm],
  )
  const sparseBands = useMemo(() => computeSparseRouteBands(samples), [samples])
  const ticks = useMemo(() => routeDensityTicks(routeLengthKm), [routeLengthKm])

  const xForKm = useCallback(
    (km: number) => PAD_LEFT + (km / safeLength) * plotWidth,
    [safeLength, plotWidth],
  )
  const yForStations = useCallback(
    (count: number) =>
      PAD_TOP + PLOT_HEIGHT - routeDensityValueHeight(count, stationScaleMax, PLOT_HEIGHT),
    [stationScaleMax],
  )
  const yForPdc = useCallback(
    (pdcCount: number) =>
      PAD_TOP +
      PLOT_HEIGHT -
      routeDensityValueHeight(Math.ceil(pdcCount / 3), pdcScaleMax, PLOT_HEIGHT),
    [pdcScaleMax],
  )

  const { stationLinePath, pdcLinePath, minPriceLinePaths, hasMinPriceCurve, yForMinPrice, priceScale } =
    useMemo(() => {
      const pricedMinSamples = samples.filter(
        (sample): sample is RouteDensitySample & { minPricePerKwh: number } =>
          sample.minPricePerKwh != null,
      )
      const scale = routePriceScale(pricedMinSamples.map((sample) => sample.minPricePerKwh))
      const yPrice = (price: number) => routePriceY(price, scale, PLOT_HEIGHT, PAD_TOP)
      const minPaths = buildSvgLinePathsWithGaps(
        samples.map((sample) => ({
          x: xForKm(sample.km),
          y: sample.minPricePerKwh != null ? yPrice(sample.minPricePerKwh) : null,
        })),
      )

      return {
        stationLinePath: buildSvgLinePath(
          samples.map((sample) => ({
            x: xForKm(sample.km),
            y: yForStations(sample.stationCount),
          })),
        ),
        pdcLinePath: buildSvgLinePath(
          samples.map((sample) => ({ x: xForKm(sample.km), y: yForPdc(sample.pdcCount) })),
        ),
        minPriceLinePaths: minPaths,
        hasMinPriceCurve: minPaths.length > 0,
        yForMinPrice: yPrice,
        priceScale: scale,
      }
    }, [samples, xForKm, yForStations, yForPdc])

  const rangeBands = useMemo(
    () => tripRangeBands(routeLengthKm, vehicleRangeKm),
    [routeLengthKm, vehicleRangeKm],
  )

  const stopCount = chargeStops.length
  const coveredStopCount = useMemo(
    () => chargeStops.filter((stop) => stop.covered).length,
    [chargeStops],
  )

  const segmentPrices = useMemo(
    () => computeTripSegmentMinPrices(routeLengthKm, stations, vehicleRangeKm),
    [routeLengthKm, stations, vehicleRangeKm],
  )
  const hasSegmentPrices = segmentPrices.some((segment) => segment.minPricePerKwh != null)

  const pickSample = (km: number) => {
    if (samples.length === 0) return
    const nearest = samples.reduce((best, sample) =>
      Math.abs(sample.km - km) < Math.abs(best.km - km) ? sample : best,
    )
    setHovered(nearest)
    onHoverKmChange?.(nearest.km)
  }

  const clearSample = () => {
    setHovered(null)
    onHoverKmChange?.(null)
  }

  return (
    <section className="trips-density" aria-label="Couverture des stations le long du trajet">
      <div className="trips-density__header">
        <div>
          <h3>Couverture</h3>
          <p className="trips-density__subtitle">
            {stopCount === 0 ? (
              <>Trajet direct · recharge lente à l&apos;arrivée</>
            ) : (
              <>
                {stopCount} arrêt{stopCount > 1 ? 's estimés' : ' estimé'} · tronçons{' '}
                {vehicleRangeKm} km
              </>
            )}
            {' · '}fenêtre {windowKm} km
            {hasCappedStationValues && (
              <> · courbe stations plafonnée à {MAX_DENSITY_BIN_SCALE}</>
            )}
          </p>
        </div>
        <div className="trips-density__legend" aria-hidden="true">
          <span className="trips-density__legend-item trips-density__legend-item--stations">
            Stations
          </span>
          <span className="trips-density__legend-item trips-density__legend-item--pdc">
            PDC
          </span>
          <span className="trips-density__legend-item trips-density__legend-item--segment">
            {vehicleRangeKm} km
          </span>
          <span className="trips-density__legend-item trips-density__legend-item--stop">
            Arrêt
          </span>
          <span className="trips-density__legend-item trips-density__legend-item--gap">
            Intervalle ≥ {gapWarningKm} km
          </span>
          {hasMinPriceCurve && (
            <span className="trips-density__legend-item trips-density__legend-item--price">
              Min €/kWh
            </span>
          )}
        </div>
      </div>

      <p className="trips-density__counts">
        {stations.length.toLocaleString('fr-FR')} stations ·{' '}
        {totalPdc.toLocaleString('fr-FR')} PDC
        {stopCount > 0 && (
          <>
            {' '}
            · {coveredStopCount}/{stopCount} arrêt
            {stopCount > 1 ? 's' : ''} couvert
            {coveredStopCount > 1 ? 's' : ''}
          </>
        )}
        {totalAvailablePdc > 0 && (
          <> · {totalAvailablePdc.toLocaleString('fr-FR')} PDC dispo</>
        )}
      </p>

      <div className="trips-density__chart-wrap">
        <svg
          className="trips-density__chart"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label={`Couverture de ${stations.length} stations et ${totalPdc} points de charge sur ${Math.round(routeLengthKm)} kilomètres`}
          onMouseLeave={clearSample}
          onPointerLeave={clearSample}
        >
          {rangeBands.map((band) => (
            <rect
              key={`${band.startKm}-${band.endKm}`}
              x={xForKm(band.startKm)}
              y={PAD_TOP}
              width={Math.max(1, xForKm(band.endKm) - xForKm(band.startKm))}
              height={PLOT_HEIGHT}
              className={
                band.index % 2 === 0
                  ? 'trips-density__range-band trips-density__range-band--alt'
                  : 'trips-density__range-band'
              }
            />
          ))}

          {chargeStops.map((stop) => {
            if (!stop.likelyStop) return null
            const { zoneStartKm, zoneEndKm, centerKm } = stop.likelyStop
            const label = `Arrêt ${stop.index}`
            const bandWidth = xForKm(zoneEndKm) - xForKm(zoneStartKm)
            if (bandWidth < 12) return null

            return (
              <g
                key={`stop-${stop.index}-${zoneStartKm}`}
                className="trips-density__stop-zone"
              >
                <rect
                  x={xForKm(zoneStartKm)}
                  y={PAD_TOP}
                  width={Math.max(1, bandWidth)}
                  height={PLOT_HEIGHT}
                  className="trips-density__stop-zone-fill"
                />
                <line
                  x1={xForKm(centerKm)}
                  y1={PAD_TOP}
                  x2={xForKm(centerKm)}
                  y2={PAD_TOP + PLOT_HEIGHT}
                  className="trips-density__stop-zone-marker"
                />
                <title>
                  {label} · ~{Math.round(centerKm)} km · {stop.likelyStop.stationCount}{' '}
                  station
                  {stop.likelyStop.stationCount > 1 ? 's' : ''} · {stop.likelyStop.pdcCount} PDC
                </title>
              </g>
            )
          })}

          {rangeBands.slice(1).map((band) => (
            <line
              key={`split-${band.startKm}`}
              x1={xForKm(band.startKm)}
              y1={PAD_TOP}
              x2={xForKm(band.startKm)}
              y2={PAD_TOP + PLOT_HEIGHT}
              className="trips-density__segment-divider"
            />
          ))}

          {sparseBands.map((band) => (
            <rect
              key={`sparse-${band.startKm}-${band.endKm}`}
              x={xForKm(band.startKm)}
              y={PAD_TOP}
              width={Math.max(1, xForKm(band.endKm) - xForKm(band.startKm))}
              height={PLOT_HEIGHT}
              className="trips-density__sparse-band"
            />
          ))}

          {gapBands.map((band) => (
            <rect
              key={`gap-${band.startKm}-${band.endKm}`}
              x={xForKm(band.startKm)}
              y={PAD_TOP}
              width={Math.max(1, xForKm(band.endKm) - xForKm(band.startKm))}
              height={PLOT_HEIGHT}
              className="trips-density__gap-band"
            >
              <title>
                Intervalle {Math.round(band.gapKm)} km sans station (≥ {gapWarningKm} km)
              </title>
            </rect>
          ))}

          {[0, stationScaleMax].map((tick) => (
            <g key={`y-station-${tick}`} className="trips-density__y-tick">
              <text x={PAD_LEFT - 6} y={yForStations(tick) + 3} textAnchor="end">
                {tick}
              </text>
            </g>
          ))}

          {hasMinPriceCurve &&
            [priceScale.min, priceScale.max].map((tick) => (
              <g key={`y-price-${tick}`} className="trips-density__y-tick trips-density__y-tick--price">
                <text
                  x={PAD_LEFT + plotWidth + 6}
                  y={yForMinPrice(tick) + 3}
                  textAnchor="start"
                >
                  {formatPriceAxisTick(tick)}
                </text>
              </g>
            ))}

          <line
            x1={PAD_LEFT}
            y1={PAD_TOP + PLOT_HEIGHT}
            x2={PAD_LEFT + plotWidth}
            y2={PAD_TOP + PLOT_HEIGHT}
            className="trips-density__baseline"
          />

          {pdcLinePath && (
            <path d={pdcLinePath} className="trips-density__line trips-density__line--pdc" />
          )}
          {minPriceLinePaths.map((path, index) => (
            <path
              key={`min-price-${index}`}
              d={path}
              className="trips-density__line trips-density__line--min-price"
            />
          ))}

          {stationLinePath && (
            <path
              d={stationLinePath}
              className="trips-density__line trips-density__line--stations"
            />
          )}

          {hasSegmentPrices &&
            segmentPrices.map((segment) => {
              if (segment.minPricePerKwh == null) return null
              const centerKm = (segment.startKm + segment.endKm) / 2
              const bandWidth = xForKm(segment.endKm) - xForKm(segment.startKm)
              if (bandWidth < 28) return null
              const labelY = yForMinPrice(segment.minPricePerKwh)

              return (
                <g
                  key={`price-label-${segment.startKm}-${segment.endKm}`}
                  className="trips-density__segment-price"
                >
                  <title>
                    Tronçon {Math.round(segment.startKm)}–{Math.round(segment.endKm)} km : min{' '}
                    {formatCompactPricePerKwh(segment.minPricePerKwh)}/kWh CB direct (
                    {segment.pricedStationCount}/{segment.stationCount} stations tarifées)
                  </title>
                  <text
                    x={xForKm(centerKm)}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="trips-density__segment-price-label"
                  >
                    min {formatCompactPricePerKwh(segment.minPricePerKwh)}
                  </text>
                </g>
              )
            })}

          {chargeStops.map((stop) => {
            if (!stop.likelyStop) return null
            const { zoneStartKm, zoneEndKm, centerKm } = stop.likelyStop
            const bandWidth = xForKm(zoneEndKm) - xForKm(zoneStartKm)
            if (bandWidth < 36) return null

            return (
              <text
                key={`stop-label-${stop.index}`}
                x={xForKm(centerKm)}
                y={STOP_LABEL_Y}
                textAnchor="middle"
                dominantBaseline="auto"
                className="trips-density__stop-zone-label"
              >
                Arrêt {stop.index}
              </text>
            )
          })}

          {samples.map((sample) => (
            <rect
              key={sample.km}
              x={xForKm(sample.km) - 8}
              y={PAD_TOP}
              width={16}
              height={PLOT_HEIGHT}
              className="trips-density__hover-target"
              onPointerEnter={() => pickSample(sample.km)}
              onPointerDown={(event) => {
                event.preventDefault()
                pickSample(sample.km)
              }}
            >
              <title>
                {Math.round(sample.km)} km : {sample.stationCount} station
                {sample.stationCount > 1 ? 's' : ''}, {sample.pdcCount} PDC (
                {sample.availablePdcCount} dispo) / {windowKm} km
                {sample.minPricePerKwh != null &&
                  ` · min ${formatCompactPricePerKwh(sample.minPricePerKwh)}/kWh`}
              </title>
            </rect>
          ))}

          {ticks.map((km) => (
            <g key={km} className="trips-density__tick">
              <line
                x1={xForKm(km)}
                y1={PAD_TOP + PLOT_HEIGHT}
                x2={xForKm(km)}
                y2={PAD_TOP + PLOT_HEIGHT + 4}
              />
              <text x={xForKm(km)} y={CHART_HEIGHT - 6} textAnchor="middle">
                {Math.round(km)}
              </text>
            </g>
          ))}
        </svg>

        {hovered && (
          <div
            className="trips-density__tooltip"
            style={{ left: `${(hovered.km / safeLength) * 100}%` }}
          >
            <strong>{Math.round(hovered.km)} km</strong>
            <span>
              {hovered.stationCount} station{hovered.stationCount > 1 ? 's' : ''} ·{' '}
              {hovered.pdcCount} PDC · {hovered.availablePdcCount} dispo
              {hovered.minPricePerKwh != null && (
                <> · min {formatCompactPricePerKwh(hovered.minPricePerKwh)}/kWh</>
              )}
            </span>
            <span className="trips-density__tooltip-hint">fenêtre {windowKm} km</span>
          </div>
        )}
      </div>

      <div className="trips-density__labels">
        <span className="trips-density__label trips-density__label--from">
          {formatTripCityLabel(fromLabel)}
        </span>
        <span className="trips-density__label trips-density__label--to">
          {formatTripCityLabel(toLabel)}
        </span>
      </div>

      {stopCount === 0 ? (
        <p className="trips-segments__direct">
          Aucun arrêt recharge rapide nécessaire — recharge lente à destination.
        </p>
      ) : (
        <ol className="trips-segments" aria-label="Arrêts recharge rapide estimés">
          {chargeStops.map((stop) => (
            <li key={stop.index} className="trips-segments__cell">
              <TripStopCard stop={stop} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
