import type { TripChargeStop } from '../lib/tripCoverage'
import { formatStopZonePriceDetailsCompact } from '../lib/tripPricing'

interface TripStopCardProps {
  stop: TripChargeStop
  className?: string
}

export function TripStopCard({ stop, className }: TripStopCardProps) {
  const kmLabel = stop.likelyStop
    ? `~${Math.round(stop.likelyStop.centerKm)} km`
    : `avant ${Math.round(stop.endKm)} km`

  const details: string[] = []
  if (stop.likelyStop) {
    details.push(`${stop.likelyStop.stationCount} st.`, `${stop.likelyStop.pdcCount} PDC`)
    const prices = formatStopZonePriceDetailsCompact(stop.minPricePerKwh, stop.avgPricePerKwh)
    if (prices) details.push(prices)
  }

  return (
    <article
      className={`trips-stop-card${stop.covered ? '' : ' trips-stop-card--uncovered'}${className ? ` ${className}` : ''}`}
    >
      <p className="trips-stop-card__line">
        <span className="trips-stop-card__title">
          Arrêt {stop.index} · {kmLabel}
        </span>
        <span
          className={`trips-stop-card__status${
            stop.covered ? ' trips-stop-card__status--ok' : ''
          }`}
        >
          {stop.covered ? 'Couvert' : 'Non couvert'}
        </span>
      </p>
      <p
        className={`trips-stop-card__line trips-stop-card__line--detail${
          stop.likelyStop ? '' : ' trips-stop-card__line--missing'
        }`}
      >
        {stop.likelyStop ? details.join(' · ') : 'Aucune borne rapide'}
      </p>
    </article>
  )
}
