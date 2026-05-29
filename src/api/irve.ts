import type { IrvePointsResponse } from '../types/irve'

const API_URL = import.meta.env.DEV
  ? '/api/irve/points/'
  : '/data/stations.json'

export async function fetchIrvePoints(): Promise<IrvePointsResponse> {
  const response = await fetch(API_URL)

  if (!response.ok) {
    throw new Error(`Impossible de charger les stations IRVE (${response.status})`)
  }

  return response.json()
}
