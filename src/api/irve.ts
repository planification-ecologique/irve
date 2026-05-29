import type { IrvePointsResponse } from '../types/irve'

const LIVE_URL = '/api/irve/points/'
const FALLBACK_URL = '/data/stations.json'

export type IrveDataSource = 'live' | 'fallback'

export interface IrveFetchResult {
  data: IrvePointsResponse
  source: IrveDataSource
}

async function fetchJson(url: string): Promise<IrvePointsResponse | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    return response.json()
  } catch {
    return null
  }
}

export async function fetchIrvePoints(): Promise<IrveFetchResult> {
  const live = await fetchJson(LIVE_URL)
  if (live) {
    return { data: live, source: 'live' }
  }

  const fallback = await fetchJson(FALLBACK_URL)
  if (fallback) {
    return { data: fallback, source: 'fallback' }
  }

  throw new Error('Impossible de charger les stations IRVE (API et snapshot indisponibles)')
}
