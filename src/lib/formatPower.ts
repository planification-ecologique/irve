/** Affichage puissance max station (0 = donnée manquante / invalide dans la source). */
export function formatMaxPowerKw(maxPower: number): string {
  if (!Number.isFinite(maxPower) || maxPower <= 0) return 'NC'
  return `${maxPower} kW`
}

export function isPowerKnown(maxPower: number): boolean {
  return Number.isFinite(maxPower) && maxPower > 0
}
