export interface TripPlace {
  label: string
  lat: number
  lng: number
}

export interface SavedTrip {
  id: string
  from: TripPlace
  to: TripPlace
  /** Autonomie utile estimée (km) entre deux recharges. */
  vehicleRangeKm: number
  /** Puissance minimale des bornes considérées sur le trajet. */
  minPowerKw: number
  /** Largeur du corridor routier (km de part et d'autre du tracé). */
  corridorKm: number
  createdAt: string
  routeCoordinates: [number, number][]
  routeDistanceKm: number
  routeDurationMinutes: number
  coverageScore: number
  coverageGrade: CoverageGrade
  coveredSegmentCount: number
  segmentCount: number
  maxGapKm: number
  stationCount: number
  /** Clés `station_key` le long du trajet (réconciliation avec données live). */
  stationKeys: string[]
}

export type CoverageGrade = 'excellent' | 'good' | 'fair' | 'poor'

export const DEFAULT_VEHICLE_RANGE_KM = 400
export const DEFAULT_CORRIDOR_KM = 15
export const DEFAULT_TRIP_MIN_POWER_KW = 150

export const COVERAGE_GRADE_LABELS: Record<CoverageGrade, string> = {
  excellent: 'Excellente',
  good: 'Bonne',
  fair: 'Partielle',
  poor: 'Insuffisante',
}
