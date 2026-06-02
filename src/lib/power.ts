/** Valeur de `minPower` pour n’afficher que les bornes statiques &lt; 50 kW. */
export const SLOW_ONLY_MIN_POWER = 0

export function isSlowOnlyPowerFilter(minPower: number): boolean {
  return minPower === SLOW_ONLY_MIN_POWER
}

export const SLOW_POWER_THRESHOLDS = [3, 7, 22] as const

export type SlowPowerThreshold = (typeof SLOW_POWER_THRESHOLDS)[number]

export const SLOW_POWER_COLORS: Record<SlowPowerThreshold, string> = {
  3: '#94a3b8',
  7: '#a78bfa',
  22: '#60a5fa',
}

export const SLOW_POWER_LABELS: Record<SlowPowerThreshold, string> = {
  3: '3–6 kW',
  7: '7–21 kW',
  22: '22–49 kW',
}

export function getSlowPowerThresholdClass(threshold: SlowPowerThreshold): string {
  return `chip--p${threshold}`
}

export const MIN_POWER_THRESHOLDS = [50, 100, 150, 180, 350] as const

export type PowerThreshold = (typeof MIN_POWER_THRESHOLDS)[number]

export const POWER_COLORS: Record<PowerThreshold, string> = {
  50: '#38bdf8',
  100: '#22d3ee',
  150: '#22d3a5',
  180: '#a3e635',
  350: '#fbbf24',
}

export const POWER_LABELS: Record<PowerThreshold, string> = {
  50: '50–99 kW',
  100: '100–149 kW',
  150: '150–179 kW',
  180: '180–349 kW',
  350: '≥350 kW',
}

export function getSlowPowerColor(maxPower: number): string {
  if (maxPower >= 22) return SLOW_POWER_COLORS[22]
  if (maxPower >= 7) return SLOW_POWER_COLORS[7]
  return SLOW_POWER_COLORS[3]
}

export function getPowerColor(maxPower: number): string {
  if (maxPower < 50) return getSlowPowerColor(maxPower)
  if (maxPower >= 350) return POWER_COLORS[350]
  if (maxPower >= 180) return POWER_COLORS[180]
  if (maxPower >= 150) return POWER_COLORS[150]
  if (maxPower >= 100) return POWER_COLORS[100]
  return POWER_COLORS[50]
}

export function getPowerThresholdClass(threshold: PowerThreshold): string {
  return `chip--p${threshold}`
}

export function getPowerBadgeClass(maxPower: number): string {
  if (!Number.isFinite(maxPower) || maxPower <= 0) return 'power-badge--unknown'
  if (maxPower >= 350) return 'power-badge--p350'
  if (maxPower >= 180) return 'power-badge--p180'
  if (maxPower >= 150) return 'power-badge--p150'
  if (maxPower >= 100) return 'power-badge--p100'
  if (maxPower >= 50) return 'power-badge--p50'
  if (maxPower >= 22) return 'power-badge--p22'
  if (maxPower >= 7) return 'power-badge--p7'
  return 'power-badge--p3'
}

export function getPowerLabel(maxPower: number): string {
  if (maxPower >= 350) return POWER_LABELS[350]
  if (maxPower >= 180) return POWER_LABELS[180]
  if (maxPower >= 150) return POWER_LABELS[150]
  if (maxPower >= 100) return POWER_LABELS[100]
  return POWER_LABELS[50]
}
