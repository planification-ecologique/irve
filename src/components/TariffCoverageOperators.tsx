import { useMemo } from 'react'
import {
  computeOperatorTariffCoverage,
  computeTariffCoverageSummary,
  formatPdcCoverageTitle,
  formatTariffCoveragePercent,
} from '../lib/tariffCoverage'
import type { Station } from '../types/irve'
import '../TariffCoverage.css'

const LIST_LIMIT = 10
const COUNT_FMT = new Intl.NumberFormat('fr-FR')

interface TariffCoverageOperatorsProps {
  stations: readonly Station[]
  loading?: boolean
}

function OperatorList({
  title,
  hint,
  rows,
  loading,
  getPricedPdc,
}: {
  title: string
  hint: string
  rows: ReturnType<typeof computeOperatorTariffCoverage>
  loading: boolean
  getPricedPdc: (row: (typeof rows)[number]) => number
}) {
  const filtered = rows.filter((row) => getPricedPdc(row) > 0).slice(0, LIST_LIMIT)

  return (
    <div className="tariff-coverage-ops__col">
      <h4 className="tariff-coverage-ops__col-title">{title}</h4>
      <p className="tariff-coverage-ops__col-hint">{hint}</p>
      {filtered.length === 0 && !loading ? (
        <p className="tariff-coverage-ops__empty">Aucun opérateur</p>
      ) : (
        <ul className="tariff-coverage-ops__list">
          {filtered.map((row) => {
            const pricedPdc = getPricedPdc(row)
            return (
              <li key={row.operator} className="tariff-coverage-ops__item">
                <span className="tariff-coverage-ops__name" title={row.operator}>
                  {row.operator}
                </span>
                <span
                  className="tariff-coverage-ops__pct"
                  title={formatPdcCoverageTitle(title, pricedPdc, row.totalPdc)}
                >
                  {loading
                    ? '…'
                    : formatTariffCoveragePercent(pricedPdc, row.totalPdc)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function TariffCoverageOperators({ stations, loading = false }: TariffCoverageOperatorsProps) {
  const summary = useMemo(() => computeTariffCoverageSummary(stations), [stations])
  const operators = useMemo(() => computeOperatorTariffCoverage(stations), [stations])

  const qcRows = useMemo(
    () =>
      [...operators]
        .filter((row) => row.qualichargePdc > 0)
        .sort((a, b) => b.qualichargePdc - a.qualichargePdc),
    [operators],
  )

  const editorialRows = useMemo(
    () =>
      [...operators]
        .filter((row) => row.displayablePdc > row.qualichargePdc)
        .sort(
          (a, b) =>
            b.displayablePdc -
            b.qualichargePdc -
            (a.displayablePdc - a.qualichargePdc),
        ),
    [operators],
  )

  return (
    <div className="tariff-coverage-ops" aria-label="Couverture tarifaire par opérateur">
      <p className="tariff-coverage-ops__summary">
        Réseau (PDC) :{' '}
        <strong>
          {loading
            ? '…'
            : formatTariffCoveragePercent(summary.qualicharge.pdc, summary.totalPdc)}
        </strong>{' '}
        API QualiCharge ·{' '}
        <strong>
          {loading
            ? '…'
            : formatTariffCoveragePercent(summary.editorial.pdc, summary.totalPdc)}
        </strong>{' '}
        éditorial ·{' '}
        <strong>
          {loading
            ? '…'
            : formatTariffCoveragePercent(summary.displayable.pdc, summary.totalPdc)}
        </strong>{' '}
        affichable
      </p>

      <p className="tariff-coverage-ops__summary">
        <strong>{loading ? '…' : COUNT_FMT.format(qcRows.length)}</strong> opérateur
        {qcRows.length !== 1 ? 's' : ''} sur{' '}
        <strong>{loading ? '…' : COUNT_FMT.format(operators.length)}</strong> renvoient un tarif via
        l’API QualiCharge
      </p>

      <div className="tariff-coverage-ops__cols">
        <OperatorList
          title="QualiCharge API"
          hint="Tarif renseigné borne par borne"
          rows={qcRows}
          loading={loading}
          getPricedPdc={(row) => row.qualichargePdc}
        />
        <OperatorList
          title="Grille éditoriale"
          hint="Prix via fiche opérateur, sans tarif API"
          rows={editorialRows}
          loading={loading}
          getPricedPdc={(row) => row.displayablePdc - row.qualichargePdc}
        />
      </div>
    </div>
  )
}
