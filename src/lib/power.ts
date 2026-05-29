export const MIN_POWER_THRESHOLDS = [50, 100, 150, 180, 350] as const

export type PowerThreshold = (typeof MIN_POWER_THRESHOLDS)[number]

export type ConnectorType = 'ccs' | 'type2' | 'chademo' | 'ef'

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

export function getPowerColor(maxPower: number): string {
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
  if (maxPower >= 350) return 'power-badge--p350'
  if (maxPower >= 180) return 'power-badge--p180'
  if (maxPower >= 150) return 'power-badge--p150'
  if (maxPower >= 100) return 'power-badge--p100'
  return 'power-badge--p50'
}

export function getPowerLabel(maxPower: number): string {
  if (maxPower >= 350) return POWER_LABELS[350]
  if (maxPower >= 180) return POWER_LABELS[180]
  if (maxPower >= 150) return POWER_LABELS[150]
  if (maxPower >= 100) return POWER_LABELS[100]
  return POWER_LABELS[50]
}
