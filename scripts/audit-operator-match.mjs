import fs from 'node:fs'

const stations = JSON.parse(
  fs.readFileSync(new URL('../public/data/stations.json', import.meta.url), 'utf8'),
).stations

const tariffsSrc = fs.readFileSync(
  new URL('../src/data/operatorTariffs.ts', import.meta.url),
  'utf8',
)

const matches = [...tariffsSrc.matchAll(/match: \[([^\]]+)\]/g)].flatMap((m) =>
  m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')),
)
const covered = new Set(matches)

const ops = {}
for (const s of stations) {
  const n = s.nom_operateur ?? '(null)'
  ops[n] = (ops[n] || 0) + 1
}

const sorted = Object.entries(ops).sort((a, b) => b[1] - a[1])
const lower = new Map()
for (const [n, c] of sorted) {
  const k = n.toLowerCase()
  if (!lower.has(k)) lower.set(k, [])
  lower.get(k).push([n, c])
}
const dupes = [...lower.entries()].filter(([, v]) => v.length > 1)

console.log(`stations: ${stations.length}, nom_operateur uniques: ${sorted.length}`)
console.log('\nDoublons casse:')
for (const [, v] of dupes) {
  console.log('  ' + v.map(([n, c]) => `${n} (${c})`).join(' | '))
}

const uncovered = sorted.filter(([n]) => !covered.has(n) && n !== '(null)')
console.log(`\nNon couverts (${uncovered.length}):`)
for (const [n, c] of uncovered.slice(0, 40)) {
  console.log(`  ${c}\t${n}`)
}
