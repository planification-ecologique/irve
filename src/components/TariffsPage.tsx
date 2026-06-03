import { useMemo, useState } from 'react'
import {
  OPERATOR_TARIFFS,
  type OperatorTariff,
  type PricingModel,
  type TariffConfidence,
} from '../data/operatorTariffs'
import {
  compareTariffsForTableSort,
  CONFIDENCE_LABELS,
  formatDirectCb,
  formatPowerRange,
  formatTariffDate,
  formatTariffPrice,
  formatTariffTierPrice,
  nextTariffTableSort,
  PRICING_MODEL_LABELS,
  tariffHasDisplayablePrice,
  tariffTableSortIndicator,
  type TariffTableSortDir,
  type TariffTableSortKey,
} from '../lib/tariffDisplay'
import {
  activeTariffPowerRangesForStations,
  computeStationCountsByTariff,
  computeTariffRangeBoxPlots,
  computeWeightedTariffAverages,
  countStationsCoveredByTariffs,
  formatOperatorDirectPriceForRange,
  type TariffPowerRange,
} from '../lib/tariffPowerRanges'
import type { Station } from '../types/irve'
import type { Theme } from '../lib/theme'
import { MAP_PATH, navigate } from '../lib/routes'
import { StatsBar } from './StatsBar'
import { TariffQualityPieChart } from './TariffQualityPieChart'
import { TariffBoxPlotChart } from './TariffRangeChart'
import '../App.css'
import '../Tariffs.css'

interface TariffsPageProps {
  theme: Theme
  onToggleTheme: () => void
  stations: Station[]
  loading?: boolean
}

type ModelFilter = PricingModel | 'all'
type ConfidenceFilter = TariffConfidence | 'all'

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
}: {
  label: string
  sortKey: TariffTableSortKey
  activeSortKey: TariffTableSortKey
  sortDir: TariffTableSortDir
  onSort: (key: TariffTableSortKey) => void
}) {
  return (
    <th scope="col">
      <button
        type="button"
        className={`tariff-matrix-table__sort${activeSortKey === sortKey ? ' tariff-matrix-table__sort--active' : ''}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className="tariff-matrix-table__sort-icon" aria-hidden="true">
          {tariffTableSortIndicator(sortKey, activeSortKey, sortDir)}
        </span>
      </button>
    </th>
  )
}

const STATION_COUNT_FMT = new Intl.NumberFormat('fr-FR')

function TariffMatrixTable({
  tariffs,
  weightedByRange,
  activeRanges,
  stationCounts,
  stationsCoveredTotal,
  sortKey,
  sortDir,
  onSort,
}: {
  tariffs: OperatorTariff[]
  weightedByRange: ReturnType<typeof computeWeightedTariffAverages>
  activeRanges: readonly TariffPowerRange[]
  stationCounts: ReadonlyMap<string, number>
  stationsCoveredTotal: number
  sortKey: TariffTableSortKey
  sortDir: TariffTableSortDir
  onSort: (key: TariffTableSortKey) => void
}) {
  return (
    <div className="tariffs-matrix-wrap">
      <table className="tariff-matrix-table">
        <thead>
          <tr>
            <SortableHeader
              label="Opérateur"
              sortKey="label"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableHeader
              label="Stations"
              sortKey="stations"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            {activeRanges.map((range) => (
              <SortableHeader
                key={range.id}
                label={range.label}
                sortKey={`range:${range.id}`}
                activeSortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
            ))}
            <SortableHeader
              label="Modèle"
              sortKey="model"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
          </tr>
          <tr className="tariff-matrix-table__avg-row">
            <th scope="row">Moyenne (PDC)</th>
            <td className="tariff-matrix-table__stations tariff-matrix-table__avg">
              {STATION_COUNT_FMT.format(stationsCoveredTotal)}
            </td>
            {activeRanges.map((range) => {
              const avg = weightedByRange.find((a) => a.rangeId === range.id)
              return (
                <td key={range.id} className="tariff-matrix-table__price tariff-matrix-table__avg">
                  {avg?.avgPrice != null ? formatTariffPrice(avg.avgPrice, '€/kWh') : '—'}
                </td>
              )
            })}
            <td />
          </tr>
        </thead>
        <tbody>
          {tariffs.map((tariff) => (
            <tr key={tariff.id}>
              <th scope="row">
                <a href={`#tariff-${tariff.id}`} className="tariff-matrix-table__link">
                  {tariff.label}
                </a>
              </th>
              <td className="tariff-matrix-table__stations">
                {STATION_COUNT_FMT.format(stationCounts.get(tariff.id) ?? 0)}
              </td>
              {activeRanges.map((range) => {
                const priceLabel = formatOperatorDirectPriceForRange(tariff, range)
                return (
                  <td
                    key={range.id}
                    className={
                      priceLabel != null
                        ? 'tariff-matrix-table__price'
                        : 'tariff-matrix-table__na'
                    }
                  >
                    {priceLabel ?? '—'}
                  </td>
                )
              })}
              <td>
                <span
                  className={`tariff-badge tariff-badge--model tariff-badge--model-${tariff.pricingModel}`}
                >
                  {PRICING_MODEL_LABELS[tariff.pricingModel]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TariffCard({ tariff }: { tariff: OperatorTariff }) {
  const directTiers = tariff.tiers.filter((t) => t.access === 'direct')
  const subscriberTiers = tariff.tiers.filter((t) => t.access === 'subscriber')
  const showPrices = tariffHasDisplayablePrice(tariff)

  return (
    <article className="tariff-card" id={`tariff-${tariff.id}`}>
      <header className="tariff-card__header">
        <div className="tariff-card__title-row">
          <h3 className="tariff-card__title">{tariff.label}</h3>
          <span
            className={`tariff-badge tariff-badge--model tariff-badge--model-${tariff.pricingModel}`}
          >
            {PRICING_MODEL_LABELS[tariff.pricingModel]}
          </span>
          <span
            className={`tariff-badge tariff-badge--confidence tariff-badge--confidence-${tariff.confidence}`}
            title="Niveau de confiance du sourcing"
          >
            {CONFIDENCE_LABELS[tariff.confidence]}
          </span>
        </div>
        {tariff.match.length > 0 && (
          <p className="tariff-card__match">
            <span className="tariff-card__match-label">QualiCharge :</span>{' '}
            {tariff.match.join(' · ')}
          </p>
        )}
      </header>

      <dl className="tariff-card__meta">
        <div>
          <dt>CB directe</dt>
          <dd>{formatDirectCb(tariff.directCbAvailable)}</dd>
        </div>
        <div>
          <dt>Relevé le</dt>
          <dd>{formatTariffDate(tariff.checkedAt)}</dd>
        </div>
        {tariff.sessionFee != null && (
          <div>
            <dt>Frais de session</dt>
            <dd>{formatTariffPrice(tariff.sessionFee, '€/session')}</dd>
          </div>
        )}
      </dl>

      {showPrices && directTiers.length > 0 && (
        <div className="tariff-card__tiers">
          <h4>Grille — accès direct</h4>
          <table className="tariff-table">
            <thead>
              <tr>
                <th scope="col">Puissance</th>
                <th scope="col">Prix</th>
                <th scope="col">Précision</th>
              </tr>
            </thead>
            <tbody>
              {directTiers.map((tier, i) => (
                <tr key={`direct-${i}`}>
                  <td>{formatPowerRange(tier)}</td>
                  <td className="tariff-table__price">{formatTariffTierPrice(tier)}</td>
                  <td>{tier.label ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subscriberTiers.length > 0 && (
        <div className="tariff-card__tiers">
          <h4>Grille — abonné / badge</h4>
          <table className="tariff-table">
            <thead>
              <tr>
                <th scope="col">Puissance</th>
                <th scope="col">Prix</th>
                <th scope="col">Précision</th>
              </tr>
            </thead>
            <tbody>
              {subscriberTiers.map((tier, i) => (
                <tr key={`sub-${i}`}>
                  <td>{formatPowerRange(tier)}</td>
                  <td className="tariff-table__price">{formatTariffTierPrice(tier)}</td>
                  <td>{tier.label ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!showPrices && tariff.tiers.length === 0 && (
        <p className="tariff-card__no-price">
          Aucun tarif national affichable — prix affiché borne par borne ou via l’appli de
          l’opérateur.
        </p>
      )}

      {tariff.notes && <p className="tariff-card__notes">{tariff.notes}</p>}

      <p className="tariff-card__source">
        <a href={tariff.source} target="_blank" rel="noopener noreferrer">
          Source officielle
        </a>
      </p>
    </article>
  )
}

export function TariffsPage({ theme, onToggleTheme, stations, loading = false }: TariffsPageProps) {
  const [query, setQuery] = useState('')
  const [modelFilter, setModelFilter] = useState<ModelFilter>('all')
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all')
  const [onlyWithPrice, setOnlyWithPrice] = useState(false)
  const [tableSortKey, setTableSortKey] = useState<TariffTableSortKey | null>(null)
  const [tableSortDir, setTableSortDir] = useState<TariffTableSortDir>('asc')

  const weightedByRange = useMemo(() => computeWeightedTariffAverages(stations), [stations])
  const boxPlotsByRange = useMemo(() => computeTariffRangeBoxPlots(stations), [stations])
  const activeRanges = useMemo(() => activeTariffPowerRangesForStations(stations), [stations])

  const qualichargeOperatorCount = useMemo(() => {
    const names = new Set(stations.map((s) => s.nom_operateur).filter(Boolean))
    return names.size
  }, [stations])

  const stationCountsByTariff = useMemo(
    () => computeStationCountsByTariff(stations, OPERATOR_TARIFFS),
    [stations],
  )

  const stationsWithDisplayableGrid = useMemo(
    () =>
      countStationsCoveredByTariffs(
        stations,
        OPERATOR_TARIFFS.filter(tariffHasDisplayablePrice),
      ),
    [stations],
  )

  const rangesById = useMemo(
    () => new Map(activeRanges.map((r) => [r.id, r])),
    [activeRanges],
  )

  const defaultTableSortKey = useMemo((): TariffTableSortKey => {
    const first = activeRanges[0]
    return first ? (`range:${first.id}` as const) : 'label'
  }, [activeRanges])

  const effectiveSortKey =
    tableSortKey != null &&
    (tableSortKey === 'label' ||
      tableSortKey === 'stations' ||
      tableSortKey === 'model' ||
      (tableSortKey.startsWith('range:') && rangesById.has(tableSortKey.slice(6))))
      ? tableSortKey
      : defaultTableSortKey

  const handleTableSort = (column: TariffTableSortKey) => {
    const next = nextTariffTableSort(effectiveSortKey, tableSortDir, column)
    setTableSortKey(next.key)
    setTableSortDir(next.dir)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...OPERATOR_TARIFFS]
      .filter((t) => {
        if (modelFilter !== 'all' && t.pricingModel !== modelFilter) return false
        if (confidenceFilter !== 'all' && t.confidence !== confidenceFilter) return false
        if (onlyWithPrice && !tariffHasDisplayablePrice(t)) return false
        if (!q) return true
        const haystack = [t.label, t.id, ...t.match, t.notes ?? '', PRICING_MODEL_LABELS[t.pricingModel]]
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .sort((a, b) =>
        compareTariffsForTableSort(
          a,
          b,
          effectiveSortKey,
          tableSortDir,
          rangesById,
          stationCountsByTariff,
        ),
      )
  }, [
    query,
    modelFilter,
    confidenceFilter,
    onlyWithPrice,
    effectiveSortKey,
    tableSortDir,
    rangesById,
    stationCountsByTariff,
  ])

  const counts = useMemo(() => {
    const byModel = {} as Record<PricingModel, number>
    for (const t of OPERATOR_TARIFFS) {
      byModel[t.pricingModel] = (byModel[t.pricingModel] ?? 0) + 1
    }
    return byModel
  }, [])

  const matrixTariffs = useMemo(
    () => (onlyWithPrice ? filtered.filter(tariffHasDisplayablePrice) : filtered),
    [filtered, onlyWithPrice],
  )

  const matrixStationsCovered = useMemo(
    () => countStationsCoveredByTariffs(stations, matrixTariffs),
    [stations, matrixTariffs],
  )

  return (
    <div className="app tariffs-app">
      <StatsBar
        stations={stations}
        availability="all"
        updatedAt={null}
        lastFetchedAt={null}
        loading={loading}
        dataSource={null}
        theme={theme}
        onToggleTheme={onToggleTheme}
        activePage="tariffs"
      />

      <div className="tariffs-page">
        <a
          href={MAP_PATH}
          className="page-back"
          onClick={(event) => {
            event.preventDefault()
            navigate(MAP_PATH)
          }}
        >
          <span aria-hidden="true">←</span> Retour à la carte
        </a>

        <header className="tariffs-page__intro">
          <div className="tariffs-page__intro-text">
            <h2>Tarifs par opérateur</h2>
            <p>
              Grilles de référence éditoriales jointes aux stations sur{' '}
              <code>nom_operateur</code> (QualiCharge). Données non live — à revérifier sur la
              source avant toute décision.
            </p>
            <p className="tariffs-page__coverage">
              <strong>{OPERATOR_TARIFFS.length}</strong> fiches ·{' '}
              <strong>{qualichargeOperatorCount}</strong> libellés <code>nom_operateur</code> ·{' '}
              <strong>{STATION_COUNT_FMT.format(stations.length)}</strong> stations ·{' '}
              <strong>{STATION_COUNT_FMT.format(stationsWithDisplayableGrid)}</strong> avec grille
              dans le tableau — doublons de casse signalés dans la page <strong>Analyse</strong>.
            </p>
          </div>
        </header>

        <div className="tariffs-page__charts">
          <TariffBoxPlotChart
            boxPlots={boxPlotsByRange}
            activeRanges={activeRanges}
            loading={loading}
          />
          <TariffQualityPieChart stations={stations} loading={loading} />
        </div>

        <div className="tariffs-toolbar">
          <label className="tariffs-search">
            <span className="tariffs-search__label">Rechercher</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Opérateur, nom QualiCharge…"
              autoComplete="off"
            />
          </label>

          <label className="tariffs-filter">
            <span className="tariffs-filter__label">Modèle</span>
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value as ModelFilter)}
            >
              <option value="all">Tous ({OPERATOR_TARIFFS.length})</option>
              <option value="national-fixed">
                National fixe ({counts['national-fixed'] ?? 0})
              </option>
              <option value="national-range">
                Fourchette nationale ({counts['national-range'] ?? 0})
              </option>
              <option value="regional-fixed">
                Régional fixe ({counts['regional-fixed'] ?? 0})
              </option>
              <option value="varies-by-site">
                Par station ({counts['varies-by-site'] ?? 0})
              </option>
              <option value="unknown">Non publié ({counts.unknown ?? 0})</option>
            </select>
          </label>

          <label className="tariffs-filter">
            <span className="tariffs-filter__label">Confiance</span>
            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)}
            >
              <option value="all">Toutes</option>
              <option value="high">Élevée</option>
              <option value="medium">Moyenne</option>
              <option value="low">Faible</option>
            </select>
          </label>

          <label className="tariffs-check">
            <input
              type="checkbox"
              checked={onlyWithPrice}
              onChange={(e) => setOnlyWithPrice(e.target.checked)}
            />
            Grille €/kWh affichable uniquement
          </label>

        </div>

        <h3 className="tariffs-section-title">Tableau par palier de puissance</h3>
        <p className="tariffs-page__sort-hint">Cliquer sur un en-tête de colonne pour trier.</p>
        <p className="tariffs-page__count" aria-live="polite">
          {matrixTariffs.length} ligne{matrixTariffs.length !== 1 ? 's' : ''}
          {matrixTariffs.length !== filtered.length && ` (${filtered.length} avec fiches)`}
          {' · '}
          {STATION_COUNT_FMT.format(matrixStationsCovered)} station
          {matrixStationsCovered !== 1 ? 's' : ''} couvertes
        </p>

        {matrixTariffs.length === 0 ? (
          <p className="tariffs-page__empty">Aucun opérateur ne correspond aux filtres.</p>
        ) : (
          <TariffMatrixTable
            tariffs={matrixTariffs}
            weightedByRange={weightedByRange}
            activeRanges={activeRanges}
            stationCounts={stationCountsByTariff}
            stationsCoveredTotal={matrixStationsCovered}
            sortKey={effectiveSortKey}
            sortDir={tableSortDir}
            onSort={handleTableSort}
          />
        )}

        <h3 className="tariffs-section-title">Fiches détaillées</h3>
        {filtered.length === 0 ? null : (
          <div className="tariffs-list">
            {filtered.map((tariff) => (
              <TariffCard key={tariff.id} tariff={tariff} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
