import type { ExpressionSpecification } from 'maplibre-gl'

/** Couleur par puissance max (points individuels). */
export const pointPowerColor: ExpressionSpecification = [
  'step',
  ['get', 'max_power'],
  '#38bdf8',
  100,
  '#22d3ee',
  150,
  '#22d3a5',
  180,
  '#a3e635',
  350,
  '#fbbf24',
]

/** Couleur par puissance max agrégée (clusters). */
export const clusterPowerColor: ExpressionSpecification = [
  'step',
  ['get', 'cluster_max_power'],
  '#38bdf8',
  100,
  '#22d3ee',
  150,
  '#22d3a5',
  180,
  '#a3e635',
  350,
  '#fbbf24',
]

export const unavailableColor = '#64748b'

/** Opacité ∝ ratio prises dispo / total. */
export const pointAvailOpacity: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['/', ['get', 'available_count'], ['max', ['get', 'pdc_count'], 1]],
  0,
  0.55,
  0.25,
  0.7,
  0.5,
  0.82,
  1,
  0.95,
]

export const clusterAvailOpacity: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['/', ['get', 'sum_available'], ['max', ['get', 'sum_pdc'], 1]],
  0,
  0.55,
  0.25,
  0.7,
  0.5,
  0.82,
  1,
  0.95,
]

export const clusterProperties = {
  sum_available: ['+', ['get', 'available_count']],
  sum_pdc: ['+', ['get', 'pdc_count']],
  cluster_max_power: ['max', ['get', 'max_power']],
}
