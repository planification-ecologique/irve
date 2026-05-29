import type { Feature, FeatureCollection, Point } from 'geojson'
import type { Station, StationFeatureProperties } from '../types/irve'

export function stationsToGeoJSON(
  stations: Station[],
): FeatureCollection<Point, StationFeatureProperties> {
  const features: Feature<Point, StationFeatureProperties>[] = stations.map(
    (station) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [station.lng, station.lat],
      },
      properties: {
        station_key: station.station_key,
        nom_station: station.nom_station,
        nom_operateur: station.nom_operateur,
        nom_amenageur: station.nom_amenageur,
        pdc_count: station.pdc_count,
        max_power: station.summary.max_power,
        available_count: station.dynamic_summary.available_count,
        has_ccs: station.summary.has_prise_type_combo_ccs,
        has_type2: station.summary.has_prise_type_2,
        has_chademo: station.summary.has_prise_type_chademo,
      },
    }),
  )

  return {
    type: 'FeatureCollection',
    features,
  }
}
