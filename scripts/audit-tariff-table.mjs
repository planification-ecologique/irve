/**
 * Opérateurs QualiCharge sans cellule prix dans le tableau /tarifs
 * (pas de tier direct €/kWh sur national-fixed | national-range | regional-fixed).
 */
import fs from 'node:fs'

const stations = JSON.parse(
  fs.readFileSync(new URL('../public/data/stations.json', import.meta.url), 'utf8'),
).stations

const src = fs.readFileSync(
  new URL('../src/data/operatorTariffs.ts', import.meta.url),
  'utf8',
)

const blocks = src.split(/\n  \{\n    id:/).slice(1)
const rows = []

for (const block of blocks) {
  const id = block.match(/^ '([^']+)'/)?.[1]
  const label = block.match(/label: '([^']+)'/)?.[1]
  const model = block.match(/pricingModel: '([^']+)'/)?.[1]
  const matchLine = block.match(/match: \[([^\]]+)\]/)?.[1] ?? ''
  const names = [...matchLine.matchAll(/'([^']+)'/g)].map((m) => m[1])
  const hasDirectKwh =
    /access: 'direct'/.test(block) && /unit: '€\/kWh'/.test(block)
  const displayable =
    ['national-fixed', 'national-range', 'regional-fixed'].includes(model) &&
    hasDirectKwh
  const valueMax = block.match(/valueMax: ([\d.]+)/)?.[1]
  const directValues = [
    ...block.matchAll(
      /value: ([\d.]+)[\s\S]*?unit: '€\/kWh'[\s\S]*?access: 'direct'/g,
    ),
  ].map((m) => m[1])

  let stationCount = 0
  for (const n of names) {
    stationCount += stations.filter((s) => s.nom_operateur === n).length
  }

  rows.push({
    id,
    label,
    model,
    names,
    stationCount,
    displayable,
    directValues,
    valueMax,
    notes: block.match(/notes:\s*\n\s*'([^']*(?:\\'[^']*)*)'/)?.[1]?.slice(0, 80),
  })
}

const missing = rows.filter((r) => !r.displayable).sort((a, b) => b.stationCount - a.stationCount)
const withPrice = rows.filter((r) => r.displayable)

console.log(`Fiches: ${rows.length}, avec prix tableau: ${withPrice.length}, sans: ${missing.length}`)
console.log(`Stations couvertes sans prix tableau: ${missing.reduce((a, r) => a + r.stationCount, 0)}`)
console.log('\n--- Sans données tableau (tri PDC) ---')
for (const r of missing) {
  console.log(
    `${String(r.stationCount).padStart(5)}\t${r.model}\t${r.label}\t${r.names.join(' | ')}`,
  )
}

console.log('\n--- Avec prix tableau ---')
for (const r of withPrice.sort((a, b) => b.stationCount - a.stationCount)) {
  const range = r.valueMax ? `${r.directValues[0]}-${r.valueMax}` : r.directValues.join(',')
  console.log(`${String(r.stationCount).padStart(5)}\t${r.model}\t${r.label}\t${range}`)
}
