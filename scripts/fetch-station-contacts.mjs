import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { QUALICHARGE_API_BASE } from '../qualicharge-api.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const stationsFile = join(root, 'public', 'data', 'stations.json')
const contactsFile = join(root, 'public', 'data', 'station-contacts.json')
const CONCURRENCY = Number(process.env.CONTACT_ENRICH_CONCURRENCY ?? 32)

async function enrichContacts(stations) {
  const contacts = {}
  let index = 0
  let done = 0

  async function worker() {
    while (index < stations.length) {
      const i = index++
      const station = stations[i]
      const url = `${QUALICHARGE_API_BASE}/api/irve/stations/${encodeURIComponent(station.id_station_itinerance)}/`

      try {
        const response = await fetch(url)
        if (response.ok) {
          const detail = await response.json()
          const tel = detail.telephone_operateur ?? null
          contacts[station.station_key] = tel
          station.telephone_operateur = tel
        } else {
          contacts[station.station_key] = null
          station.telephone_operateur = null
        }
      } catch {
        contacts[station.station_key] = null
        station.telephone_operateur = null
      }

      done += 1
      if (done % 500 === 0 || done === stations.length) {
        console.log(`Contacts ${done}/${stations.length}`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  return contacts
}

async function main() {
  const data = JSON.parse(readFileSync(stationsFile, 'utf8'))
  const stations = data.stations ?? []
  if (stations.length === 0) {
    throw new Error('Aucune station dans public/data/stations.json')
  }

  console.log(`Enrichissement contacts (${stations.length} stations, ${CONCURRENCY} workers)…`)
  const contacts = await enrichContacts(stations)

  writeFileSync(
    contactsFile,
    JSON.stringify({ updatedAt: data.updatedAt ?? null, contacts }),
  )
  writeFileSync(stationsFile, JSON.stringify(data))

  const placeholders = Object.values(contacts).filter(
    (tel) => typeof tel === 'string' && /\+33-1-00-00-00-00/i.test(tel),
  ).length
  console.log(
    `Saved station-contacts.json (${Object.keys(contacts).length} entrées, ${placeholders} × 01 00 00 00 00)`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
