import type { ExpressionSpecification } from 'maplibre-gl'

/** Couleur par puissance max (points individuels). */
export const pointPowerColor: ExpressionSpecification = [
  'step',
  ['get', 'max_power'],
  '#94a3b8',
  7,
  '#a78bfa',
  22,
  '#60a5fa',
  50,
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
  '#94a3b8',
  7,
  '#a78bfa',
  22,
  '#60a5fa',
  50,
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

/** Opacité fixe quand la dispo temps réel est absente (données statiques). */
export const staticPointOpacity = 0.88

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

export const livePointColor: ExpressionSpecification = [
  'case',
  ['==', ['get', 'available_count'], 0],
  unavailableColor,
  pointPowerColor,
]

export const livePointOpacity: ExpressionSpecification = [
  'case',
  ['==', ['get', 'available_count'], 0],
  0.45,
  pointAvailOpacity,
]

export const liveClusterColor: ExpressionSpecification = [
  'case',
  ['==', ['get', 'sum_available'], 0],
  unavailableColor,
  clusterPowerColor,
]

export const liveClusterOpacity: ExpressionSpecification = [
  'case',
  ['==', ['get', 'sum_available'], 0],
  0.45,
  clusterAvailOpacity,
]

/** 1 si tous les points du cluster sont statiques (sans dispo live). */
export const mixedPointColor: ExpressionSpecification = [
  'case',
  ['==', ['get', 'availability_nc'], 1],
  pointPowerColor,
  livePointColor,
]

export const mixedPointOpacity: ExpressionSpecification = [
  'case',
  ['==', ['get', 'availability_nc'], 1],
  staticPointOpacity,
  livePointOpacity,
]

export const mixedClusterColor: ExpressionSpecification = [
  'case',
  ['==', ['get', 'all_static'], 1],
  clusterPowerColor,
  liveClusterColor,
]

export const mixedClusterOpacity: ExpressionSpecification = [
  'case',
  ['==', ['get', 'all_static'], 1],
  staticPointOpacity,
  liveClusterOpacity,
]

export const clusterProperties = {
  sum_available: ['+', ['get', 'available_count']],
  sum_pdc: ['+', ['get', 'pdc_count']],
  cluster_max_power: ['max', ['get', 'max_power']],
  all_static: ['min', ['get', 'availability_nc']],
}
