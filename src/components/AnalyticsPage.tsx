import { useEffect, useMemo, useState } from 'react'
import type { IrveDataSource } from '../api/irve'
import { TRANSPORT_IRVE_DATASET_URL, SLOW_MAX_POWER_KW } from '../api/transportIrve'
import { useSlowIrveData } from '../hooks/useSlowIrveData'
import { useStationContactCache } from '../hooks/useStationContactCache'
import {
  ANALYTICS_POWER_BUCKETS,
  bucketMetricValue,
  computeIrveAnalytics,
  connectorMetricValue,
  formatAnalyticsPercent,
  namedCountMetricValue,
  operatorMetricTotal,
  segmentMetricValue,
  type AnalyticsMetric,
  type ConnectorStats,
  type OperatorStats,
} from '../lib/analytics'
import { CONNECTOR_META } from '../lib/connectors'
import {
  contactMetricValue,
  computeContactAnomalyWarnings,
} from '../lib/contactAnomalies'
import {
  anomalyMetricValue,
  computeDataAnomalyWarnings,
} from '../lib/dataAnomalies'
import { isStaticStation, mergeStationLists } from '../lib/stationOrigin'
import type { Theme } from '../lib/theme'
import type { Station } from '../types/irve'
import { ConnectorIcon, type ConnectorIconType } from './ConnectorIcon'
import { PowerDistributionChart } from './PowerDistributionChart'
import { TariffCoverageOperators } from './TariffCoverageOperators'
import { StatsBar } from './StatsBar'
import { computeTariffCoverageSummary, formatTariffCoveragePercent } from '../lib/tariffCoverage'
import '../App.css'
import '../Analytics.css'
import '../TariffCoverage.css'

interface AnalyticsPageProps {
  liveStations: Station[]
  liveLoading: boolean
  liveDataSource: IrveDataSource | null
  updatedAt: string | null
  lastFetchedAt: Date | null
  theme: Theme
  onToggleTheme: () => void
}

function formatNum(value: number, loading: boolean): string {
  return loading ? '…' : value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}

function formatInt(value: number, loading: boolean): string {
  return loading ? '…' : value.toLocaleString('fr-FR')
}

const ANALYTICS_LIST_PAGE_SIZE = 20

const ANALYTICS_CONNECTOR_ROWS: {
  key: keyof ConnectorStats
  type: ConnectorIconType
  label: string
}[] = [
  { key: 'ccs', type: 'ccs', label: CONNECTOR_META.ccs.label },
  { key: 'type2', type: 'type2', label: CONNECTOR_META.type2.label },
  { key: 'chademo', type: 'chademo', label: CONNECTOR_META.chademo.label },
  { key: 'ef', type: 'ef', label: CONNECTOR_META.ef.label },
  { key: 'autre', type: 'autre', label: 'Autre' },
]

interface BarRowProps {
  label: string
  value: number
  max: number
  sublabel?: string
  color?: string
  icon?: React.ReactNode
  loading: boolean
}

function BarRow({ label, value, max, sublabel, color, icon, loading }: BarRowProps) {
  const pct = max > 0 && !loading ? Math.max(4, (value / max) * 100) : 0

  return (
    <div className="analytics-bar">
      <div className="analytics-bar__head">
        <span className="analytics-bar__label" title={label}>
          {icon && <span className="analytics-bar__icon">{icon}</span>}
          <span className="analytics-bar__label-text">{label}</span>
        </span>
        <span className="analytics-bar__value">
          {formatInt(value, loading)}
          {sublabel && <span className="analytics-bar__sub">{sublabel}</span>}
        </span>
      </div>
      <div className="analytics-bar__track" aria-hidden="true">
        <div
          className="analytics-bar__fill"
          style={{
            width: loading ? '0%' : `${pct}%`,
            backgroundColor: color ?? 'var(--accent)',
          }}
        />
      </div>
    </div>
  )
}

interface AnalyticsMetricSwitchProps {
  metric: AnalyticsMetric
  onChange: (metric: AnalyticsMetric) => void
}

function AnalyticsMetricSwitch({ metric, onChange }: AnalyticsMetricSwitchProps) {
  return (
    <div className="analytics-metric-switch" role="group" aria-label="Unité des graphiques">
      <button
        type="button"
        className={`analytics-metric-switch__btn${metric === 'stations' ? ' analytics-metric-switch__btn--active' : ''}`}
        aria-pressed={metric === 'stations'}
        onClick={() => onChange('stations')}
      >
        Stations
      </button>
      <button
        type="button"
        className={`analytics-metric-switch__btn${metric === 'pdc' ? ' analytics-metric-switch__btn--active' : ''}`}
        aria-pressed={metric === 'pdc'}
        onClick={() => onChange('pdc')}
      >
        PDC
      </button>
    </div>
  )
}

interface OperatorBarRowProps {
  row: OperatorStats
  max: number
  metric: AnalyticsMetric
  loading: boolean
}

function OperatorBarRow({ row, max, metric, loading }: OperatorBarRowProps) {
  const total = operatorMetricTotal(row, metric)
  const barPct = max > 0 && !loading ? Math.max(4, (total / max) * 100) : 0
  const segments = row.powerSegments.filter((segment) => segmentMetricValue(segment, metric) > 0)

  return (
    <div className="analytics-bar">
      <div className="analytics-bar__head">
        <span className="analytics-bar__label" title={row.name}>
          {row.name}
        </span>
        <span className="analytics-bar__value">{formatInt(total, loading)}</span>
      </div>
      <div className="analytics-bar__track" aria-hidden="true">
        <div className="analytics-bar__stack" style={{ width: loading ? '0%' : `${barPct}%` }}>
          {segments.map((segment) => {
            const value = segmentMetricValue(segment, metric)
            return (
              <span
                key={segment.bucketId}
                className="analytics-bar__segment"
                style={{
                  flexGrow: value,
                  backgroundColor: segment.color,
                }}
                title={`${segment.label} : ${value.toLocaleString('fr-FR')} ${metric === 'stations' ? 'stations' : 'PDC'}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function AnalyticsPage({
  liveStations,
  liveLoading,
  liveDataSource,
  updatedAt,
  lastFetchedAt,
  theme,
  onToggleTheme,
}: AnalyticsPageProps) {
  const [addSlowLayer, setAddSlowLayer] = useState(false)
  const [chartMetric, setChartMetric] = useState<AnalyticsMetric>('stations')
  const [operatorPage, setOperatorPage] = useState(1)
  const [amenageurPage, setAmenageurPage] = useState(1)
  const { data: slowData, loading: slowLoading, error: slowError } = useSlowIrveData(addSlowLayer)

  const stations = useMemo(() => {
    const slow = addSlowLayer ? (slowData?.stations ?? []) : []
    return mergeStationLists(liveStations, slow)
  }, [liveStations, slowData, addSlowLayer])

  const dataSource: IrveDataSource | null = useMemo(() => {
    if (!addSlowLayer) return liveDataSource
    if (liveDataSource === 'live') return 'mixed'
    if (liveDataSource) return liveDataSource
    return 'transport-slow'
  }, [addSlowLayer, liveDataSource])

  const loading = liveLoading && liveStations.length === 0

  const analytics = useMemo(() => computeIrveAnalytics(stations), [stations])

  const tariffCoverage = useMemo(() => computeTariffCoverageSummary(stations), [stations])

  const contactByKey = useStationContactCache(true)

  const anomalyWarnings = useMemo(() => computeDataAnomalyWarnings(stations), [stations])

  const contactWarnings = useMemo(
    () => computeContactAnomalyWarnings(stations, contactByKey ?? null),
    [stations, contactByKey],
  )

  const sortedOperators = useMemo(
    () =>
      [...analytics.operators].sort(
        (a, b) =>
          operatorMetricTotal(b, chartMetric) - operatorMetricTotal(a, chartMetric) ||
          b.pdc - a.pdc,
      ),
    [analytics.operators, chartMetric],
  )

  const operatorPageCount = Math.max(1, Math.ceil(sortedOperators.length / ANALYTICS_LIST_PAGE_SIZE))

  useEffect(() => {
    setOperatorPage(1)
  }, [chartMetric, sortedOperators.length])

  useEffect(() => {
    if (operatorPage > operatorPageCount) {
      setOperatorPage(operatorPageCount)
    }
  }, [operatorPage, operatorPageCount])

  const displayOperators = useMemo(() => {
    const start = (operatorPage - 1) * ANALYTICS_LIST_PAGE_SIZE
    return sortedOperators.slice(start, start + ANALYTICS_LIST_PAGE_SIZE)
  }, [sortedOperators, operatorPage])

  const operatorRangeStart =
    sortedOperators.length === 0 ? 0 : (operatorPage - 1) * ANALYTICS_LIST_PAGE_SIZE + 1
  const operatorRangeEnd = Math.min(
    operatorPage * ANALYTICS_LIST_PAGE_SIZE,
    sortedOperators.length,
  )

  const sortedAmenageurs = useMemo(
    () =>
      [...analytics.amenageurs].sort(
        (a, b) =>
          namedCountMetricValue(b, chartMetric) - namedCountMetricValue(a, chartMetric) ||
          b.pdc - a.pdc,
      ),
    [analytics.amenageurs, chartMetric],
  )

  const amenageurPageCount = Math.max(
    1,
    Math.ceil(sortedAmenageurs.length / ANALYTICS_LIST_PAGE_SIZE),
  )

  useEffect(() => {
    setAmenageurPage(1)
  }, [chartMetric, sortedAmenageurs.length])

  useEffect(() => {
    if (amenageurPage > amenageurPageCount) {
      setAmenageurPage(amenageurPageCount)
    }
  }, [amenageurPage, amenageurPageCount])

  const displayAmenageurs = useMemo(() => {
    const start = (amenageurPage - 1) * ANALYTICS_LIST_PAGE_SIZE
    return sortedAmenageurs.slice(start, start + ANALYTICS_LIST_PAGE_SIZE)
  }, [sortedAmenageurs, amenageurPage])

  const amenageurRangeStart =
    sortedAmenageurs.length === 0 ? 0 : (amenageurPage - 1) * ANALYTICS_LIST_PAGE_SIZE + 1
  const amenageurRangeEnd = Math.min(
    amenageurPage * ANALYTICS_LIST_PAGE_SIZE,
    sortedAmenageurs.length,
  )

  const displayPowerBuckets = useMemo(() => {
    const buckets = analytics.powerBuckets.filter((b) => bucketMetricValue(b, chartMetric) > 0)
    if (addSlowLayer) return buckets
    return buckets.filter((bucket) => {
      const def = ANALYTICS_POWER_BUCKETS.find((d) => d.id === bucket.id)
      return def !== undefined && def.min >= SLOW_MAX_POWER_KW
    })
  }, [analytics.powerBuckets, chartMetric, addSlowLayer])

  const maxOperator = sortedOperators[0]
    ? operatorMetricTotal(sortedOperators[0], chartMetric)
    : 1
  const maxAmenageur = sortedAmenageurs[0]
    ? namedCountMetricValue(sortedAmenageurs[0], chartMetric)
    : 1
  const maxConnector = Math.max(
    connectorMetricValue(analytics.connectors.ccs, chartMetric),
    connectorMetricValue(analytics.connectors.type2, chartMetric),
    connectorMetricValue(analytics.connectors.chademo, chartMetric),
    connectorMetricValue(analytics.connectors.ef, chartMetric),
    connectorMetricValue(analytics.connectors.autre, chartMetric),
    1,
  )

  const sortedAnomalyWarnings = useMemo(
    () =>
      [...anomalyWarnings].sort(
        (a, b) => anomalyMetricValue(b, chartMetric) - anomalyMetricValue(a, chartMetric),
      ),
    [anomalyWarnings, chartMetric],
  )

  const maxAnomaly = sortedAnomalyWarnings[0]
    ? anomalyMetricValue(sortedAnomalyWarnings[0], chartMetric)
    : 1

  const sortedContactWarnings = useMemo(
    () =>
      [...contactWarnings].sort(
        (a, b) => contactMetricValue(b, chartMetric) - contactMetricValue(a, chartMetric),
      ),
    [contactWarnings, chartMetric],
  )

  const contactEligibleTotal = useMemo(() => {
    const live = stations.filter((station) => !isStaticStation(station))
    return chartMetric === 'stations'
      ? live.length
      : live.reduce((sum, station) => sum + station.pdc_count, 0)
  }, [stations, chartMetric])

  const contactCacheReady = contactByKey !== undefined

  const uniqueOperators = useMemo(() => {
    const set = new Set(stations.map((s) => s.nom_operateur.trim() || 'Non renseigné'))
    return set.size
  }, [stations])

  const legendBuckets = useMemo(
    () => analytics.powerBuckets.filter((bucket) => bucketMetricValue(bucket, chartMetric) > 0),
    [analytics.powerBuckets, chartMetric],
  )

  const metricLabel = chartMetric === 'stations' ? 'stations' : 'points de charge'

  return (
    <div className="app analytics-app">
      <StatsBar
        stations={stations}
        availability="all"
        updatedAt={updatedAt}
        lastFetchedAt={lastFetchedAt}
        loading={loading}
        dataSource={dataSource}
        theme={theme}
        onToggleTheme={onToggleTheme}
        activePage="analytics"
      />

      <div className="analytics-page">
        <header className="analytics-page__intro">
          <div className="analytics-page__intro-text">
            <h2>Analyse des données IRVE</h2>
            <p>
              Synthèse sur {formatInt(stations.length, loading || slowLoading)} stations
              {addSlowLayer ? ' (live QualiCharge + bornes < 50 kW)' : ' (QualiCharge live)'}.
            </p>
          </div>
          <button
            type="button"
            className={`slow-switch${addSlowLayer ? ' slow-switch--on' : ''}`}
            role="switch"
            aria-checked={addSlowLayer}
            disabled={slowLoading}
            title={TRANSPORT_IRVE_DATASET_URL}
            onClick={() => setAddSlowLayer((on) => !on)}
          >
            <span className="slow-switch__track" aria-hidden="true">
              <span className="slow-switch__thumb" />
            </span>
            <span className="slow-switch__text">
              {slowLoading
                ? 'Chargement…'
                : `Ajouter les bornes lentes (< ${SLOW_MAX_POWER_KW} kW)`}
            </span>
          </button>
        </header>

        {addSlowLayer && slowError && (
          <p className="analytics-page__error" role="alert">
            {slowError}
          </p>
        )}

        <section className="analytics-grid analytics-grid--kpis" aria-label="Indicateurs clés">
          <article className="analytics-kpi">
            <span className="analytics-kpi__value">{formatInt(analytics.totalStations, loading)}</span>
            <span className="analytics-kpi__label">Stations</span>
          </article>
          <article className="analytics-kpi">
            <span className="analytics-kpi__value">{formatInt(analytics.totalPdc, loading)}</span>
            <span className="analytics-kpi__label">Points de charge</span>
          </article>
          <article className="analytics-kpi">
            <span className="analytics-kpi__value">{formatNum(analytics.avgPdcPerStation, loading)}</span>
            <span className="analytics-kpi__label">PDC / station (moy.)</span>
          </article>
          <article className="analytics-kpi">
            <span className="analytics-kpi__value analytics-kpi__value--accent">
              {formatInt(uniqueOperators, loading)}
            </span>
            <span className="analytics-kpi__label">Opérateurs distincts</span>
          </article>
          <article className="analytics-kpi">
            <span className="analytics-kpi__value">{formatInt(analytics.ultraFastStations, loading)}</span>
            <span className="analytics-kpi__label">Stations ≥ 150 kW</span>
          </article>
          <article className="analytics-kpi">
            <span className="analytics-kpi__value">{formatInt(analytics.highPowerStations, loading)}</span>
            <span className="analytics-kpi__label">Stations ≥ 100 kW</span>
          </article>
          <article className="analytics-kpi">
            <span className="analytics-kpi__value analytics-kpi__value--accent">
              {loading
                ? '…'
                : formatTariffCoveragePercent(
                    tariffCoverage.qualicharge.stations,
                    tariffCoverage.totalStations,
                  )}
            </span>
            <span className="analytics-kpi__label">Tarif QualiCharge</span>
          </article>
          <article className="analytics-kpi">
            <span className="analytics-kpi__value">
              {loading
                ? '…'
                : formatTariffCoveragePercent(
                    tariffCoverage.displayable.stations,
                    tariffCoverage.totalStations,
                  )}
            </span>
            <span className="analytics-kpi__label">Prix affichable</span>
          </article>
        </section>

        {analytics.liveAvailability && (
          <section className="analytics-panel" aria-label="Disponibilité PDC temps réel">
            <h3>Disponibilité PDC (données live)</h3>
            <p className="analytics-panel__hint">
              Comptage par point de charge ·{' '}
              {formatInt(analytics.liveAvailability.stationsWithAvailability, loading)} stations avec retour
              dynamique · taux global {formatNum(analytics.liveAvailability.availabilityRate, loading)} % des
              PDC
            </p>
            <div className="analytics-grid analytics-grid--availability">
              <article className="analytics-kpi analytics-kpi--compact">
                <span className="analytics-kpi__value analytics-kpi__value--accent">
                  {formatInt(analytics.liveAvailability.available, loading)}
                </span>
                <span className="analytics-kpi__label">PDC libres</span>
                <span className="analytics-kpi__pct">
                  {formatAnalyticsPercent(
                    analytics.liveAvailability.available,
                    analytics.liveAvailability.totalPdc,
                  )}
                </span>
              </article>
              <article className="analytics-kpi analytics-kpi--compact">
                <span className="analytics-kpi__value analytics-kpi__value--warn">
                  {formatInt(analytics.liveAvailability.occupied, loading)}
                </span>
                <span className="analytics-kpi__label">PDC occupées</span>
                <span className="analytics-kpi__pct">
                  {formatAnalyticsPercent(
                    analytics.liveAvailability.occupied,
                    analytics.liveAvailability.totalPdc,
                  )}
                </span>
              </article>
              <article className="analytics-kpi analytics-kpi--compact">
                <span className="analytics-kpi__value">
                  {formatInt(analytics.liveAvailability.reserved, loading)}
                </span>
                <span className="analytics-kpi__label">PDC réservées</span>
                <span className="analytics-kpi__pct">
                  {formatAnalyticsPercent(
                    analytics.liveAvailability.reserved,
                    analytics.liveAvailability.totalPdc,
                  )}
                </span>
              </article>
              <article className="analytics-kpi analytics-kpi--compact">
                <span className="analytics-kpi__value analytics-kpi__value--muted">
                  {formatInt(analytics.liveAvailability.outOfService, loading)}
                </span>
                <span className="analytics-kpi__label">PDC hors service</span>
                <span className="analytics-kpi__pct">
                  {formatAnalyticsPercent(
                    analytics.liveAvailability.outOfService,
                    analytics.liveAvailability.totalPdc,
                  )}
                </span>
              </article>
            </div>
          </section>
        )}

        <div className="analytics-charts-toolbar">
          <AnalyticsMetricSwitch metric={chartMetric} onChange={setChartMetric} />
          <p className="analytics-charts-toolbar__hint">Graphiques en {metricLabel}</p>
        </div>

        <div className="analytics-columns">
          <section className="analytics-panel" aria-label="Top opérateurs">
            <div className="analytics-panel__head">
              <div>
                <h3>{chartMetric === 'stations' ? 'Stations' : 'PDC'} par opérateur</h3>
                <p className="analytics-panel__hint">
                  {sortedOperators.length.toLocaleString('fr-FR')} opérateurs · barres empilées par
                  puissance max. station
                </p>
              </div>
              {sortedOperators.length > ANALYTICS_LIST_PAGE_SIZE && (
                <nav className="analytics-pagination" aria-label="Pagination opérateurs">
                  <button
                    type="button"
                    className="analytics-pagination__btn"
                    disabled={operatorPage <= 1 || loading}
                    onClick={() => setOperatorPage((p) => p - 1)}
                  >
                    Précédent
                  </button>
                  <span className="analytics-pagination__status">
                    {operatorRangeStart}–{operatorRangeEnd} / {formatInt(sortedOperators.length, loading)}
                  </span>
                  <button
                    type="button"
                    className="analytics-pagination__btn"
                    disabled={operatorPage >= operatorPageCount || loading}
                    onClick={() => setOperatorPage((p) => p + 1)}
                  >
                    Suivant
                  </button>
                </nav>
              )}
            </div>
            {legendBuckets.length > 0 && (
              <ul className="analytics-legend" aria-label="Légende puissance">
                {ANALYTICS_POWER_BUCKETS.filter((def) =>
                  legendBuckets.some((b) => b.id === def.id),
                ).map((def) => (
                  <li key={def.id}>
                    <span className="analytics-legend__swatch" style={{ backgroundColor: def.color }} />
                    {def.label}
                  </li>
                ))}
              </ul>
            )}
            <div className="analytics-bars">
              {displayOperators.map((row) => (
                <OperatorBarRow
                  key={row.name}
                  row={row}
                  max={maxOperator}
                  metric={chartMetric}
                  loading={loading}
                />
              ))}
              {displayOperators.length === 0 && !loading && (
                <p className="analytics-empty">Aucune donnée opérateur.</p>
              )}
            </div>
          </section>

          <section className="analytics-panel" aria-label="Puissance et connecteurs">
            <div className="analytics-panel__section">
              <h3>Répartition par puissance max.</h3>
              <p className="analytics-panel__hint">
                Part relative par tranche (kW max. station)
                {!addSlowLayer && ' · tranches < 50 kW masquées (données live uniquement)'}
              </p>
              <PowerDistributionChart
                buckets={displayPowerBuckets}
                metric={chartMetric}
                loading={loading}
              />
            </div>

            <div className="analytics-panel__section analytics-panel__section--divider">
              <h3>Connecteurs présents</h3>
              <p className="analytics-panel__hint">
                {chartMetric === 'stations'
                  ? 'Stations ayant au moins une prise du type'
                  : 'PDC sur stations ayant le connecteur'}
              </p>
              <div className="analytics-bars analytics-bars--connectors">
                {ANALYTICS_CONNECTOR_ROWS.map((row) => (
                  <BarRow
                    key={row.key}
                    label={row.label}
                    icon={<ConnectorIcon type={row.type} size={26} />}
                    value={connectorMetricValue(analytics.connectors[row.key], chartMetric)}
                    max={maxConnector}
                    loading={loading}
                  />
                ))}
              </div>
            </div>

            {anomalyWarnings.length > 0 && (
              <div className="analytics-panel__section analytics-panel__section--divider">
                <h3>Incohérences détectées</h3>
                <p className="analytics-panel__hint">
                  Libellés <code>nom_operateur</code> en double, combinaisons prise / puissance
                  suspectes · unité : {metricLabel}
                </p>
                <div className="analytics-bars analytics-bars--anomalies">
                  {sortedAnomalyWarnings.map((warning) => (
                    <BarRow
                      key={warning.id}
                      label={warning.title}
                      value={anomalyMetricValue(warning, chartMetric)}
                      max={maxAnomaly}
                      color="#f59e0b"
                      loading={loading}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="analytics-panel" aria-label="Services et accès">
            <h3>Services &amp; accès</h3>
            <div className="analytics-grid analytics-grid--services">
              <article className="analytics-kpi analytics-kpi--compact">
                <span className="analytics-kpi__value">{formatInt(analytics.gratuit, loading)}</span>
                <span className="analytics-kpi__label">Gratuites</span>
              </article>
              <article className="analytics-kpi analytics-kpi--compact">
                <span className="analytics-kpi__value">{formatInt(analytics.paiementCb, loading)}</span>
                <span className="analytics-kpi__label">Paiement CB</span>
                <span className="analytics-kpi__pct">
                  {formatAnalyticsPercent(analytics.paiementCb, analytics.totalStations)}
                </span>
              </article>
              <article className="analytics-kpi analytics-kpi--compact">
                <span className="analytics-kpi__value">{formatInt(analytics.reservation, loading)}</span>
                <span className="analytics-kpi__label">Réservation</span>
                <span className="analytics-kpi__pct">
                  {formatAnalyticsPercent(analytics.reservation, analytics.totalStations)}
                </span>
              </article>
              <article className="analytics-kpi analytics-kpi--compact">
                <span className="analytics-kpi__value analytics-kpi__value--accent">
                  {formatInt(tariffCoverage.qualicharge.stations, loading)}
                </span>
                <span className="analytics-kpi__label">Tarif QualiCharge</span>
                <span className="analytics-kpi__pct">
                  {formatTariffCoveragePercent(
                    tariffCoverage.qualicharge.pdc,
                    tariffCoverage.totalPdc,
                  )}{' '}
                  PDC
                </span>
              </article>
              <article className="analytics-kpi analytics-kpi--compact">
                <span className="analytics-kpi__value">
                  {formatInt(tariffCoverage.displayable.stations, loading)}
                </span>
                <span className="analytics-kpi__label">Prix affichable</span>
                <span className="analytics-kpi__pct">
                  {formatTariffCoveragePercent(
                    tariffCoverage.displayable.pdc,
                    tariffCoverage.totalPdc,
                  )}{' '}
                  PDC
                </span>
              </article>
              {contactCacheReady &&
                sortedContactWarnings.map((warning) => {
                  const value = contactMetricValue(warning, chartMetric)
                  return (
                    <article
                      key={warning.id}
                      className="analytics-kpi analytics-kpi--compact"
                      title={warning.description}
                    >
                      <span className="analytics-kpi__value analytics-kpi__value--danger">
                        {formatInt(value, loading)}
                      </span>
                      <span className="analytics-kpi__label">{warning.title}</span>
                      <span className="analytics-kpi__pct">
                        {formatAnalyticsPercent(value, contactEligibleTotal)}
                      </span>
                    </article>
                  )
                })}
            </div>

            <TariffCoverageOperators stations={stations} loading={loading} />

            {contactCacheReady && contactByKey === null && contactWarnings.length === 0 && (
              <p className="analytics-panel__hint">
                Contacts opérateur : exécutez <code>npm run fetch:contacts</code> puis redéployez
                pour afficher les indicateurs de numéros suspects.
              </p>
            )}

            {sortedAmenageurs.length > 0 && (
              <>
                <div className="analytics-panel__head analytics-panel__head--sub">
                  <div>
                    <h4 className="analytics-panel__subhead">
                      {chartMetric === 'stations' ? 'Stations' : 'PDC'} par aménageur
                    </h4>
                    <p className="analytics-panel__hint">
                      {sortedAmenageurs.length.toLocaleString('fr-FR')} aménageurs
                    </p>
                  </div>
                  {sortedAmenageurs.length > ANALYTICS_LIST_PAGE_SIZE && (
                    <nav className="analytics-pagination" aria-label="Pagination aménageurs">
                      <button
                        type="button"
                        className="analytics-pagination__btn"
                        disabled={amenageurPage <= 1 || loading}
                        onClick={() => setAmenageurPage((p) => p - 1)}
                      >
                        Précédent
                      </button>
                      <span className="analytics-pagination__status">
                        {amenageurRangeStart}–{amenageurRangeEnd} /{' '}
                        {formatInt(sortedAmenageurs.length, loading)}
                      </span>
                      <button
                        type="button"
                        className="analytics-pagination__btn"
                        disabled={amenageurPage >= amenageurPageCount || loading}
                        onClick={() => setAmenageurPage((p) => p + 1)}
                      >
                        Suivant
                      </button>
                    </nav>
                  )}
                </div>
                <div className="analytics-bars analytics-bars--compact">
                  {displayAmenageurs.map((row) => (
                    <BarRow
                      key={row.name}
                      label={row.name}
                      value={namedCountMetricValue(row, chartMetric)}
                      max={maxAmenageur}
                      loading={loading}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

        {(anomalyWarnings.length > 0 || contactWarnings.length > 0) && (
          <section className="analytics-warnings" aria-label="Anomalies dans les données">
            <h3>Anomalies dans les données</h3>
            <p className="analytics-warnings__intro">
              Incohérences possibles dans les fiches source QualiCharge (libellés opérateur,
              connecteurs, contacts).
            </p>
            <ul className="analytics-warnings__list">
              {contactWarnings.map((warning) => (
                <li key={`contact-${warning.id}`} className="analytics-warnings__item">
                  <p className="analytics-warnings__title">{warning.title}</p>
                  <p className="analytics-warnings__counts">
                    {formatInt(warning.stations, loading)} stations · {formatInt(warning.pdc, loading)} PDC
                  </p>
                  <p className="analytics-warnings__desc">{warning.description}</p>
                </li>
              ))}
              {anomalyWarnings.map((warning) => (
                <li key={warning.id} className="analytics-warnings__item">
                  <p className="analytics-warnings__title">{warning.title}</p>
                  <p className="analytics-warnings__counts">
                    {formatInt(warning.stations, loading)} stations · {formatInt(warning.pdc, loading)} PDC
                  </p>
                  <p className="analytics-warnings__desc">{warning.description}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

      </div>
    </div>
  )
}
