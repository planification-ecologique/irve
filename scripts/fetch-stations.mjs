import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { QUALICHARGE_API_BASE } from '../qualicharge-api.mjs'

const API_URL = `${QUALICHARGE_API_BASE}/api/irve/points/`
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'data')
const outFile = join(outDir, 'stations.json')
const exclusions = JSON.parse(
  readFileSync(join(root, 'station-exclusions.json'), 'utf8'),
)
const excludedKeys = new Set(exclusions.stationKeys)

async function fetchStations() {
  console.log('Fetching IRVE data…')
  const response = await fetch(API_URL)

  if (!response.ok) {
    throw new Error(`API error ${response.status}`)
  }

  const data = await response.json()
  const before = data.stations?.length ?? 0
  data.stations = (data.stations ?? []).filter(
    (station) => !excludedKeys.has(station.station_key),
  )
  data.total = data.stations.length

  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, JSON.stringify(data))

  const removed = before - data.stations.length
  console.log(
    `Saved ${data.stations.length} stations → public/data/stations.json` +
      (removed > 0 ? ` (${removed} exclue(s))` : ''),
  )
}

fetchStations().catch((error) => {
  console.error(error)
  process.exit(1)
})
