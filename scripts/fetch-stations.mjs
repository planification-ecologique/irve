import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_URL = 'https://qualicharge-carto.osc-fr1.scalingo.io/api/irve/points/'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'data')
const outFile = join(outDir, 'stations.json')

async function fetchStations() {
  console.log('Fetching IRVE data…')
  const response = await fetch(API_URL)

  if (!response.ok) {
    throw new Error(`API error ${response.status}`)
  }

  const data = await response.json()
  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, JSON.stringify(data))
  console.log(`Saved ${data.stations?.length ?? 0} stations → public/data/stations.json`)
}

fetchStations().catch((error) => {
  console.error(error)
  process.exit(1)
})
