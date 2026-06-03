import { useMemo } from 'react'
import {
  bucketMetricValue,
  formatAnalyticsPercent,
  type AnalyticsMetric,
  type BucketCount,
} from '../lib/analytics'

interface PowerDistributionChartProps {
  buckets: BucketCount[]
  metric: AnalyticsMetric
  loading: boolean
}

interface PieSlice {
  id: string
  label: string
  color: string
  value: number
}

function buildConicGradient(slices: PieSlice[], total: number): string {
  if (total <= 0) return 'var(--subtle-fill)'

  let acc = 0
  const stops = slices.map((slice) => {
    const pct = (slice.value / total) * 100
    const start = acc
    acc += pct
    return `${slice.color} ${start}% ${acc}%`
  })

  return `conic-gradient(${stops.join(', ')})`
}

function formatInt(value: number, loading: boolean): string {
  return loading ? '…' : value.toLocaleString('fr-FR')
}

export function PowerDistributionChart({
  buckets,
  metric,
  loading,
}: PowerDistributionChartProps) {
  const slices = useMemo(
    () =>
      buckets
        .map((bucket) => ({
          id: bucket.id,
          label: bucket.label,
          color: bucket.color,
          value: bucketMetricValue(bucket, metric),
        }))
        .filter((slice) => slice.value > 0),
    [buckets, metric],
  )

  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const gradient = useMemo(() => buildConicGradient(slices, total), [slices, total])

  const metricUnit = metric === 'stations' ? 'stations' : 'PDC'
  const ariaLabel = loading
    ? 'Répartition par puissance en cours de chargement'
    : slices.length === 0
      ? 'Aucune donnée pour la répartition par puissance'
      : `Répartition par puissance : ${slices
          .map((slice) => `${slice.label} ${formatAnalyticsPercent(slice.value, total)}`)
          .join(', ')}`

  if (!loading && slices.length === 0) {
    return <p className="analytics-empty">Aucune donnée pour cette répartition.</p>
  }

  return (
    <div className="analytics-pie">
      <div
        className={`analytics-pie__chart${loading ? ' analytics-pie__chart--loading' : ''}`}
        style={loading ? undefined : { background: gradient }}
        role="img"
        aria-label={ariaLabel}
      />

      <ul className="analytics-pie__legend" aria-label="Détail par tranche">
        {slices.map((slice) => (
          <li key={slice.id} className="analytics-pie__legend-item">
            <span className="analytics-pie__swatch" style={{ backgroundColor: slice.color }} />
            <span className="analytics-pie__legend-label">{slice.label}</span>
            <span className="analytics-pie__legend-value">
              {formatInt(slice.value, loading)}{' '}
              <span className="analytics-pie__legend-pct">
                ({formatAnalyticsPercent(slice.value, total)})
              </span>
            </span>
          </li>
        ))}
      </ul>

      {!loading && total > 0 && (
        <p className="analytics-pie__total">
          Total : {total.toLocaleString('fr-FR')} {metricUnit}
        </p>
      )}
    </div>
  )
}
