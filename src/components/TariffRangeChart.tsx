import { useMemo } from 'react'
import {
  tariffBoxPlotScale,
  type TariffPowerRange,
  type TariffRangeBoxPlot,
} from '../lib/tariffPowerRanges'
import { formatTariffPrice } from '../lib/tariffDisplay'

const PRICE_FMT = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function pctInScale(value: number, scaleMin: number, scaleMax: number): number {
  const span = scaleMax - scaleMin
  if (span <= 0) return 0
  return Math.min(100, Math.max(0, ((value - scaleMin) / span) * 100))
}

interface TariffBoxPlotChartProps {
  boxPlots: TariffRangeBoxPlot[]
  activeRanges: readonly TariffPowerRange[]
  loading?: boolean
}

function BoxPlotRow({
  range,
  plot,
  scaleMin,
  scaleMax,
  loading,
}: {
  range: TariffPowerRange
  plot: TariffRangeBoxPlot
  scaleMin: number
  scaleMax: number
  loading: boolean
}) {
  const hasData = plot.pricedPdcCount > 0

  const lowerPct = pctInScale(plot.lowerWhisker, scaleMin, scaleMax)
  const q1Pct = pctInScale(plot.q1, scaleMin, scaleMax)
  const medianPct = pctInScale(plot.median, scaleMin, scaleMax)
  const q3Pct = pctInScale(plot.q3, scaleMin, scaleMax)
  const upperPct = pctInScale(plot.upperWhisker, scaleMin, scaleMax)

  const ariaLabel = hasData
    ? `${range.label} : Q1 ${PRICE_FMT.format(plot.q1)}, médiane ${PRICE_FMT.format(plot.median)}, Q3 ${PRICE_FMT.format(plot.q3)}, moustaches ${PRICE_FMT.format(plot.lowerWhisker)} à ${PRICE_FMT.format(plot.upperWhisker)} €/kWh`
    : `${range.label} : pas de données tarifées`

  return (
    <div className="tariffs-box__row">
      <div className="tariffs-box__head">
        <span className="tariffs-box__label">{range.label}</span>
        <span className="tariffs-box__meta">
          {loading
            ? '…'
            : hasData
              ? `n = ${plot.pricedPdcCount.toLocaleString('fr-FR')} PDC · ${plot.stationCount} sta.`
              : `${plot.pdcCount.toLocaleString('fr-FR')} PDC (non tarifés)`}
        </span>
      </div>

      <div className="tariffs-box__scale" aria-hidden="true">
        <span>{PRICE_FMT.format(scaleMin)}</span>
        <span>{PRICE_FMT.format((scaleMin + scaleMax) / 2)}</span>
        <span>{PRICE_FMT.format(scaleMax)} €/kWh</span>
      </div>

      <div className="tariffs-box__track" role="img" aria-label={ariaLabel}>
        {!loading && hasData && (
          <>
            <div
              className="tariffs-box__whisker tariffs-box__whisker--low"
              style={{
                left: `${lowerPct}%`,
                width: `${Math.max(q1Pct - lowerPct, 0.3)}%`,
              }}
            />
            <div
              className="tariffs-box__whisker tariffs-box__whisker--high"
              style={{
                left: `${q3Pct}%`,
                width: `${Math.max(upperPct - q3Pct, 0.3)}%`,
              }}
            />
            <div
              className="tariffs-box__box"
              style={{
                left: `${q1Pct}%`,
                width: `${Math.max(q3Pct - q1Pct, 0.8)}%`,
                borderColor: range.color,
                backgroundColor: `color-mix(in srgb, ${range.color} 22%, transparent)`,
              }}
            />
            <div
              className="tariffs-box__median"
              style={{ left: `${medianPct}%`, backgroundColor: range.color }}
              title={`Médiane ${formatTariffPrice(plot.median, '€/kWh')}`}
            />
            {plot.outliers.map((outlier, i) => (
              <div
                key={`${outlier}-${i}`}
                className="tariffs-box__outlier"
                style={{ left: `${pctInScale(outlier, scaleMin, scaleMax)}%` }}
                title={`Valeur atypique ${formatTariffPrice(outlier, '€/kWh')}`}
              />
            ))}
          </>
        )}
      </div>

      {hasData && !loading && (
        <p className="tariffs-box__caption">
          {formatTariffPrice(plot.lowerWhisker, '€/kWh')} · méd.{' '}
          {formatTariffPrice(plot.median, '€/kWh')} ·{' '}
          {formatTariffPrice(plot.upperWhisker, '€/kWh')}
        </p>
      )}
    </div>
  )
}

export function TariffBoxPlotChart({
  boxPlots,
  activeRanges,
  loading = false,
}: TariffBoxPlotChartProps) {
  const visiblePlots = useMemo(
    () => boxPlots.filter((b) => activeRanges.some((r) => r.id === b.rangeId)),
    [boxPlots, activeRanges],
  )

  const scale = useMemo(() => tariffBoxPlotScale(visiblePlots), [visiblePlots])

  const rows = useMemo(
    () =>
      activeRanges.map((range) => ({
        range,
        plot:
          boxPlots.find((b) => b.rangeId === range.id) ?? {
            rangeId: range.id,
            pdcCount: 0,
            pricedPdcCount: 0,
            stationCount: 0,
            q1: 0,
            median: 0,
            q3: 0,
            lowerWhisker: 0,
            upperWhisker: 0,
            outliers: [],
          },
      })),
    [boxPlots, activeRanges],
  )

  const hasData = visiblePlots.some((b) => b.pricedPdcCount > 0)

  if (!loading && activeRanges.length === 0) {
    return null
  }

  if (!loading && !hasData) {
    return (
      <p className="tariffs-page__empty">
        Pas assez de stations avec grille fixe pour tracer un box plot.
      </p>
    )
  }

  return (
    <section className="tariffs-box" aria-labelledby="tariffs-box-title">
      <h3 id="tariffs-box-title" className="tariffs-box__title">
        Distribution des prix par palier (box plot)
      </h3>
      <p className="tariffs-box__hint">
        Quartiles pondérés par PDC · boîte Q1–Q3 · trait médiane · moustaches 1,5× IQR.
      </p>

      <div className="tariffs-box__rows">
        {rows.map(({ range, plot }) => (
          <BoxPlotRow
            key={range.id}
            range={range}
            plot={plot}
            scaleMin={scale.min}
            scaleMax={scale.max}
            loading={loading}
          />
        ))}
      </div>
    </section>
  )
}
