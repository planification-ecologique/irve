import { useEffect, useRef, useCallback } from 'react'
import maplibregl, { type GeoJSONSource, type Map, type MapMouseEvent } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import type { Station, StationFeatureProperties } from '../types/irve'
import { stationsToGeoJSON } from '../lib/geojson'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const FRANCE_CENTER: [number, number] = [2.5, 46.6]
const FRANCE_ZOOM = 5.2

interface IrveMapProps {
  stations: Station[]
  selectedKey: string | null
  onSelect: (station: Station | null) => void
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function IrveMap({ stations, selectedKey, onSelect }: IrveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const stationsRef = useRef(stations)
  const selectedKeyRef = useRef(selectedKey)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const hoveredKeyRef = useRef<string | null>(null)

  stationsRef.current = stations
  selectedKeyRef.current = selectedKey

  const findStation = useCallback((key: string) => {
    return stationsRef.current.find((station) => station.station_key === key) ?? null
  }, [])

  const hideHoverPopup = useCallback(() => {
    popupRef.current?.remove()
    popupRef.current = null
    hoveredKeyRef.current = null
  }, [])

  const showHoverPopup = useCallback(
    (map: Map, feature: Feature<Point, StationFeatureProperties>) => {
      const props = feature.properties
      if (!props) return
      if (props.station_key === selectedKeyRef.current) return

      hideHoverPopup()
      hoveredKeyRef.current = props.station_key

      const availHtml =
        props.available_count > 0
          ? `<span class="map-popup__avail">${props.available_count} dispo.</span>`
          : '<span class="map-popup__none">Indisponible</span>'

      const html = `
        <div class="map-popup map-popup--hover">
          <strong>${escapeHtml(props.nom_station)}</strong>
          <span>${escapeHtml(props.nom_operateur)}</span>
          <div class="map-popup__row">
            <span class="map-popup__power">${props.max_power} kW</span>
            <span class="map-popup__pdc">${props.pdc_count} PDC</span>
            ${availHtml}
          </div>
        </div>
      `

      popupRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: 'irve-popup irve-popup--hover',
      })
        .setLngLat(feature.geometry.coordinates as [number, number])
        .setHTML(html)
        .addTo(map)
    },
    [hideHoverPopup],
  )

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: FRANCE_CENTER,
      zoom: FRANCE_ZOOM,
      pitch: 0,
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    map.on('load', () => {
      map.addSource('stations', {
        type: 'geojson',
        data: stationsToGeoJSON(stationsRef.current),
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 50,
      })

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'stations',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#1e3a5f',
            50,
            '#1d4ed8',
            200,
            '#0891b2',
            500,
            '#059669',
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            18,
            50,
            24,
            200,
            30,
            500,
            36,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.25)',
          'circle-opacity': 0.92,
        },
      })

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'stations',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Bold'],
          'text-size': 13,
        },
        paint: {
          'text-color': '#ffffff',
        },
      })

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'stations',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'case',
            ['==', ['get', 'available_count'], 0],
            '#64748b',
            [
              'step',
              ['get', 'max_power'],
              '#38bdf8',
              100,
              '#22d3ee',
              150,
              '#22d3a5',
              180,
              '#a3e635',
              350,
              '#fbbf24',
            ],
          ],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8,
            4,
            12,
            7,
            15,
            10,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'available_count'], 0],
            'rgba(148, 163, 184, 0.25)',
            'rgba(255,255,255,0.35)',
          ],
          'circle-opacity': [
            'case',
            ['==', ['get', 'available_count'], 0],
            0.45,
            0.95,
          ],
        },
      })

      map.addLayer({
        id: 'unclustered-point-glow',
        type: 'circle',
        source: 'stations',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['>', ['get', 'available_count'], 0],
        ],
        paint: {
          'circle-color': '#22d3a5',
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8,
            8,
            12,
            12,
            15,
            16,
          ],
          'circle-opacity': 0.15,
          'circle-blur': 0.6,
        },
      })
    })

    map.on('click', 'clusters', (event: MapMouseEvent) => {
      hideHoverPopup()
      onSelect(null)

      const features = map.queryRenderedFeatures(event.point, { layers: ['clusters'] })
      const cluster = features[0]
      if (!cluster?.properties?.cluster_id) return

      const source = map.getSource('stations') as GeoJSONSource
      source.getClusterExpansionZoom(cluster.properties.cluster_id).then((zoom) => {
        map.easeTo({
          center: (cluster.geometry as Point).coordinates as [number, number],
          zoom,
        })
      })
    })

    map.on('click', 'unclustered-point', (event: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: ['unclustered-point'],
      })
      const feature = features[0]
      if (!feature?.properties?.station_key) return

      hideHoverPopup()

      const station = findStation(feature.properties.station_key as string)
      if (station) {
        onSelect(station)
      }
    })

    map.on('click', (event: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: ['unclustered-point', 'clusters'],
      })
      if (features.length === 0) {
        hideHoverPopup()
        onSelect(null)
      }
    })

    map.on('mouseenter', 'unclustered-point', (event: MapMouseEvent) => {
      map.getCanvas().style.cursor = 'pointer'

      const features = map.queryRenderedFeatures(event.point, {
        layers: ['unclustered-point'],
      })
      const feature = features[0]
      if (!feature?.properties?.station_key) return

      showHoverPopup(map, feature as unknown as Feature<Point, StationFeatureProperties>)
    })

    map.on('mousemove', 'unclustered-point', (event: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: ['unclustered-point'],
      })
      const feature = features[0]
      const key = feature?.properties?.station_key as string | undefined

      if (!key || key === hoveredKeyRef.current) return

      showHoverPopup(map, feature as unknown as Feature<Point, StationFeatureProperties>)
    })

    map.on('mouseleave', 'unclustered-point', () => {
      map.getCanvas().style.cursor = ''
      hideHoverPopup()
    })

    map.on('mouseenter', 'clusters', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'clusters', () => {
      map.getCanvas().style.cursor = ''
    })

    mapRef.current = map

    return () => {
      hideHoverPopup()
      map.remove()
      mapRef.current = null
    }
  }, [findStation, hideHoverPopup, onSelect, showHoverPopup])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const updateData = () => {
      const source = map.getSource('stations') as GeoJSONSource | undefined
      source?.setData(stationsToGeoJSON(stations))
    }

    if (map.isStyleLoaded()) {
      updateData()
      return
    }

    map.once('load', updateData)
    return () => {
      map.off('load', updateData)
    }
  }, [stations])

  useEffect(() => {
    hideHoverPopup()
  }, [selectedKey, hideHoverPopup])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedKey) return

    const station = findStation(selectedKey)
    if (!station) return

    map.flyTo({
      center: [station.lng, station.lat],
      zoom: Math.max(map.getZoom(), 14),
      speed: 1.2,
    })
  }, [selectedKey, findStation])

  return <div ref={containerRef} className="irve-map" />
}
