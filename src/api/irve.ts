import type { IrvePointsResponse, StationDetail } from '../types/irve'

const LIVE_URL = '/api/irve/points/'
const FALLBACK_URL = '/data/stations.json'

function stationDetailUrl(id: string): string {
  return `/api/irve/stations/${encodeURIComponent(id)}/`
}

/** Intervalle de rafraîchissement quand l’API live répond (aligné cache proxy 2 min). */
export const POLL_INTERVAL_MS = 2 * 60 * 1000
export const POLL_INTERVAL_MINUTES = POLL_INTERVAL_MS / 60_000

export type IrveDataSource = 'live' | 'fallback'

export interface IrveFetchResult {
  data: IrvePointsResponse
  source: IrveDataSource
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    return response.json() as Promise<T>
  } catch {
    return null
  }
}

export async function fetchIrvePoints(): Promise<IrveFetchResult> {
  const live = await fetchJson<IrvePointsResponse>(LIVE_URL)
  if (live) {
    return { data: live, source: 'live' }
  }

  const fallback = await fetchJson<IrvePointsResponse>(FALLBACK_URL)
  if (fallback) {
    return { data: fallback, source: 'fallback' }
  }

  throw new Error('Impossible de charger les stations IRVE (API et snapshot indisponibles)')
}

export async function fetchStationDetail(id: string): Promise<StationDetail | null> {
  return fetchJson<StationDetail>(stationDetailUrl(id))
}
