import type { IrvePointsResponse } from '../types/irve'

/** Jeu [BETA] Base nationale consolidée IRVE — données statiques (resource 84013). */
export const TRANSPORT_IRVE_DATASET_URL =
  'https://transport.data.gouv.fr/datasets/beta-base-nationale-des-points-de-recharge-pour-vehicules-electriques-en-france-irve'

export const TRANSPORT_IRVE_CSV_URL =
  'https://transport.data.gouv.fr/resources/84013/download'

export const SLOW_MAX_POWER_KW = 50

const SLOW_STATIONS_URL = '/data/slow-stations.json'

export async function fetchSlowIrveStations(): Promise<IrvePointsResponse> {
  const response = await fetch(SLOW_STATIONS_URL)
  if (!response.ok) {
    throw new Error(
      'Impossible de charger les bornes < 50 kW (exécutez npm run fetch:slow)',
    )
  }
  return response.json() as Promise<IrvePointsResponse>
}
