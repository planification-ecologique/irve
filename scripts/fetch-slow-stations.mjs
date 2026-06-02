import { createReadStream, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  normalizeFranceCoords,
  parseCoordonneesXY,
} from './lib/france-coords.mjs'

/** Consolidation dédoublonnée — transport.data.gouv.fr (schéma IRVE statique 2.3.1). */
const CSV_URL =
  'https://transport.data.gouv.fr/resources/84013/download'

const SLOW_MAX_POWER_KW = 50

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'data')
const outFile = join(outDir, 'slow-stations.json')

function parseCsvLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }

  fields.push(current)
  return fields
}

function parseBool(value) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'oui'
}

function emptyDynamicSummary() {
  return {
    pdcs_with_dynamic_count: 0,
    en_service_count: 0,
    libre_count: 0,
    occupied_count: 0,
    reserved_count: 0,
    available_count: 0,
  }
}

async function fetchSlowStations() {
  console.log('Fetching IRVE static consolidation (<50 kW)…')
  const response = await fetch(CSV_URL)
  if (!response.ok) {
    throw new Error(`Download failed ${response.status}`)
  }

  const tmpPath = join(outDir, '.irve-consolidated.csv')
  mkdirSync(outDir, { recursive: true })
  const buffer = Buffer.from(await response.arrayBuffer())
  writeFileSync(tmpPath, buffer)

  const rl = createInterface({
    input: createReadStream(tmpPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  let headers = null
  const stations = new Map()
  let rowIndex = 0
  let slowPdcCount = 0
  let swappedCoords = 0
  let droppedOutsideFrance = 0
  let droppedZeroPower = 0

  for await (const line of rl) {
    if (!line.trim()) continue
    const cols = parseCsvLine(line)
    if (!headers) {
      headers = Object.fromEntries(cols.map((name, index) => [name, index]))
      continue
    }

    rowIndex++
    const power = Number.parseFloat(cols[headers.puissance_nominale])
    if (!Number.isFinite(power) || power <= 0) {
      droppedZeroPower++
      continue
    }
    if (power >= SLOW_MAX_POWER_KW) continue

    slowPdcCount++
    const stationId = cols[headers.id_station_itinerance]
    if (!stationId) continue

    let station = stations.get(stationId)
    if (!station) {
      const rawLat = Number.parseFloat(cols[headers.consolidated_latitude])
      const rawLng = Number.parseFloat(cols[headers.consolidated_longitude])
      let coords =
        normalizeFranceCoords(rawLat, rawLng) ??
        parseCoordonneesXY(cols[headers.coordonneesXY])

      if (!coords) {
        droppedOutsideFrance++
        continue
      }
      if (coords.swapped) swappedCoords++

      station = {
        station_key: stationId,
        data_origin: 'transport-static',
        id: stations.size + 1,
        lat: coords.lat,
        lng: coords.lng,
        id_station_itinerance: stationId,
        nom_station: cols[headers.nom_station] ?? '',
        nom_amenageur: cols[headers.nom_amenageur] ?? '',
        nom_operateur: cols[headers.nom_operateur] ?? '',
        condition_acces: cols[headers.condition_acces] ?? '',
        accessibilite_pmr: cols[headers.accessibilite_pmr] ?? '',
        gratuit: parseBool(cols[headers.gratuit]) ? true : null,
        paiement_acte: parseBool(cols[headers.paiement_acte]),
        paiement_cb: parseBool(cols[headers.paiement_cb]) ? true : null,
        reservation: parseBool(cols[headers.reservation]),
        station_deux_roues: parseBool(cols[headers.station_deux_roues]),
        pdc_count: 0,
        pdc_itinerance_ids: [],
        has_tarification: Boolean(cols[headers.tarification]?.trim()),
        summary: {
          max_power: 0,
          total_power: 0,
          has_prise_type_ef: false,
          has_prise_type_2: false,
          has_prise_type_combo_ccs: false,
          has_prise_type_chademo: false,
          has_prise_type_autre: false,
          price_per_kwh: null,
          pricing_value: null,
          pricing_dimension: null,
          pricing_unit: null,
          pricing_status: 'UNKNOWN',
          pricing_headline: null,
          applicable_tariff_count: 0,
        },
        dynamic_summary: emptyDynamicSummary(),
      }
      stations.set(stationId, station)
    }

    station.pdc_count += 1
    station.pdc_itinerance_ids.push(cols[headers.id_pdc_itinerance])
    station.summary.max_power = Math.max(station.summary.max_power, power)
    station.summary.total_power += power
    station.summary.has_prise_type_ef ||= parseBool(cols[headers.prise_type_ef])
    station.summary.has_prise_type_2 ||= parseBool(cols[headers.prise_type_2])
    station.summary.has_prise_type_combo_ccs ||= parseBool(
      cols[headers.prise_type_combo_ccs],
    )
    station.summary.has_prise_type_chademo ||= parseBool(cols[headers.prise_type_chademo])
    station.summary.has_prise_type_autre ||= parseBool(cols[headers.prise_type_autre])
  }

  const stationList = [...stations.values()]
  const payload = {
    stations: stationList,
    total: stationList.length,
    updatedAt: new Date().toISOString(),
    source: 'transport.data.gouv.fr',
    maxPowerKw: SLOW_MAX_POWER_KW,
  }

  writeFileSync(outFile, JSON.stringify(payload))
  try {
    unlinkSync(tmpPath)
  } catch {
    // ignore
  }
  console.log(
    `Saved ${stationList.length} stations (${slowPdcCount} PDC < ${SLOW_MAX_POWER_KW} kW) → public/data/slow-stations.json`,
  )
  if (swappedCoords > 0) {
    console.log(`  ${swappedCoords.toLocaleString('fr-FR')} coordonnées lat/lng corrigées`)
  }
  if (droppedZeroPower > 0) {
    console.log(`  ${droppedZeroPower.toLocaleString('fr-FR')} PDC ignorées (puissance ≤ 0 kW)`)
  }
  if (droppedOutsideFrance > 0) {
    console.log(`  ${droppedOutsideFrance.toLocaleString('fr-FR')} stations hors France (coords invalides)`)
  }
}

fetchSlowStations().catch((error) => {
  console.error(error)
  process.exit(1)
})
