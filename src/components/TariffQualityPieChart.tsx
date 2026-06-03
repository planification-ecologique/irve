import { useMemo } from 'react'
import {
  computeStationTariffQualityBreakdown,
  STATION_TARIFF_QUALITY_LABELS,
  type StationTariffDataQuality,
  type StationTariffQualityBreakdown,
} from '../lib/tariffDisplay'
import type { Station } from '../types/irve'

const COUNT_FMT = new Intl.NumberFormat('fr-FR')
const PCT_FMT = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 1,
})

const QUALITY_COLORS: Record<StationTariffDataQuality, string> = {
  reliable: '#10b981',
  approximate: '#f59e0b',
  missing: '#94a3b8',
}

const QUALITY_ORDER: StationTariffDataQuality[] = ['reliable', 'approximate', 'missing']

function pct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0
}

function conicGradient(breakdown: StationTariffQualityBreakdown): string {
  const { total, reliable, approximate } = breakdown
  if (total === 0) return 'conic-gradient(#94a3b8 0 100%)'

  const rEnd = pct(reliable, total)
  const aEnd = rEnd + pct(approximate, total)

  return `conic-gradient(
    ${QUALITY_COLORS.reliable} 0% ${rEnd}%,
    ${QUALITY_COLORS.approximate} ${rEnd}% ${aEnd}%,
    ${QUALITY_COLORS.missing} ${aEnd}% 100%
  )`
}

interface TariffQualityPieChartProps {
  stations: readonly Station[]
  loading?: boolean
}

export function TariffQualityPieChart({ stations, loading = false }: TariffQualityPieChartProps) {
  const breakdown = useMemo(
    () => computeStationTariffQualityBreakdown(stations),
    [stations],
  )

  const slices = useMemo(
    () =>
      QUALITY_ORDER.map((key) => ({
        key,
        label: STATION_TARIFF_QUALITY_LABELS[key],
        count: breakdown[key],
        percent: pct(breakdown[key], breakdown.total),
        color: QUALITY_COLORS[key],
      })).filter((s) => s.count > 0 || breakdown.total === 0),
    [breakdown],
  )

  const ariaSummary = loading
    ? 'Répartition en cours de chargement'
    : breakdown.total === 0
      ? 'Aucune station'
      : slices
          .map((s) => `${s.label} : ${COUNT_FMT.format(s.count)} (${PCT_FMT.format(s.percent)} %)`)
          .join('. ')

  return (
    <section className="tariffs-quality" aria-labelledby="tariffs-quality-title">
      <h3 id="tariffs-quality-title" className="tariffs-quality__title">
        Qualité des données tarifaires
      </h3>
      <p className="tariffs-quality__hint">
        Par station QualiCharge · fiable = grille fixe haute confiance · approx. = fourchette ou
        confiance moyenne · manquant = pas de €/kWh affichable.
      </p>

      <div className="tariffs-quality__body">
        <div
          className="tariffs-quality__pie"
          style={{ background: loading ? undefined : conicGradient(breakdown) }}
          role="img"
          aria-label={ariaSummary}
        >
          {loading ? (
            <span className="tariffs-quality__pie-loading">…</span>
          ) : (
            <div className="tariffs-quality__pie-hole" aria-hidden="true">
              <span className="tariffs-quality__pie-total">
                {COUNT_FMT.format(breakdown.total)}
              </span>
              <span className="tariffs-quality__pie-total-label">stations</span>
            </div>
          )}
        </div>

        <ul className="tariffs-quality__legend">
          {QUALITY_ORDER.map((key) => {
            const count = breakdown[key]
            const percent = pct(count, breakdown.total)
            return (
              <li key={key} className="tariffs-quality__legend-item">
                <span
                  className="tariffs-quality__swatch"
                  style={{ background: QUALITY_COLORS[key] }}
                  aria-hidden="true"
                />
                <span className="tariffs-quality__legend-text">
                  <span className="tariffs-quality__legend-label">
                    {STATION_TARIFF_QUALITY_LABELS[key]}
                  </span>
                  <span className="tariffs-quality__legend-meta">
                    {loading
                      ? '…'
                      : `${COUNT_FMT.format(count)} (${PCT_FMT.format(percent)} %)`}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
