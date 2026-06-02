import { useEffect, useRef, useCallback } from 'react'
import maplibregl, { type GeoJSONSource, type Map, type MapMouseEvent } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import type { Station, StationFeatureProperties } from '../types/irve'
import { stationsToGeoJSON } from '../lib/geojson'
import { applyFrenchLabels, getCartoStyleUrl, MAP_LOCALE_FR, preserveStationStyle } from '../lib/mapStyle'
import type { Theme } from '../lib/theme'
import { clusterProperties, mixedClusterColor, mixedClusterOpacity, mixedPointColor, mixedPointOpacity } from '../lib/mapLayers'
import { getPowerBadgeClass } from '../lib/power'
import { getAvailabilityTone } from '../lib/stationDisplay'

const FRANCE_CENTER: [number, number] = [2.5, 46.6]
const FRANCE_ZOOM = 5.2

interface IrveMapProps {
  stations: Station[]
  selectedKey: string | null
  onSelect: (station: Station | null) => void
  theme: Theme
}

function addStationLayers(map: Map, stations: Station[]) {
  if (map.getSource('stations')) return

  map.addSource('stations', {
    type: 'geojson',
    data: stationsToGeoJSON(stations),
    cluster: true,
    clusterMaxZoom: 13,
    clusterRadius: 50,
    clusterProperties,
  })

  map.addLayer({
    id: 'cluster-glow',
    type: 'circle',
    source: 'stations',
    filter: ['all', ['has', 'point_count'], ['>', ['get', 'sum_available'], 0]],
    paint: {
      'circle-color': '#22d3a5',
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        26,
        10,
        32,
        50,
        40,
        200,
        48,
      ],
      'circle-opacity': 0.12,
      'circle-blur': 0.6,
    },
  })

  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'stations',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': mixedClusterColor,
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        18,
        10,
        22,
        50,
        28,
        200,
        34,
      ],
      'circle-opacity': mixedClusterOpacity,
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
      'circle-color': mixedPointColor,
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
      'circle-opacity': mixedPointOpacity,
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
}

function setupMapStyle(map: Map, stations: Station[]) {
  applyFrenchLabels(map)

  const source = map.getSource('stations') as GeoJSONSource | undefined
  if (source) {
    source.setData(stationsToGeoJSON(stations))
    return
  }

  addStationLayers(map, stations)
}

type StyleLoadListener = () => void

function onStyleLoad(map: Map, listener: StyleLoadListener): () => void {
  map.on('style.load' as 'load', listener as () => void)
  return () => map.off('style.load' as 'load', listener as () => void)
}

function onceStyleLoad(map: Map, listener: StyleLoadListener): () => void {
  const run: StyleLoadListener = () => {
    map.off('style.load' as 'load', run as () => void)
    listener()
  }
  map.on('style.load' as 'load', run as () => void)
  return () => map.off('style.load' as 'load', run as () => void)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function IrveMap({ stations, selectedKey, onSelect, theme }: IrveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const themeRef = useRef(theme)
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
        props.availability_nc === 1
          ? '<span class="map-popup__nc">Dispo NC</span>'
          : (() => {
              const availTone = getAvailabilityTone(props.available_count)
              const availClass = availTone === 'available' ? 'map-popup__avail' : 'map-popup__none'
              return `<span class="${availClass}">${props.available_count} sur ${props.pdc_count} PDC disponibles</span>`
            })()
      const powerClass = getPowerBadgeClass(props.max_power)

      const html = `
        <div class="map-popup map-popup--hover">
          <strong>${escapeHtml(props.nom_station)}</strong>
          <span>${escapeHtml(props.nom_operateur)}</span>
          <div class="map-popup__row">
            <span class="map-popup__power ${powerClass}">${props.max_power} kW</span>
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
      style: getCartoStyleUrl(themeRef.current),
      center: FRANCE_CENTER,
      zoom: FRANCE_ZOOM,
      pitch: 0,
      attributionControl: false,
      locale: { ...MAP_LOCALE_FR },
    })

    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserLocation: true,
        showAccuracyCircle: true,
      }),
      'bottom-right',
    )
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    const syncStationLayers = () => {
      setupMapStyle(map, stationsRef.current)
    }
    const detachStyleLoad = onStyleLoad(map, syncStationLayers)

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
      detachStyleLoad()
      hideHoverPopup()
      map.remove()
      mapRef.current = null
    }
  }, [findStation, hideHoverPopup, onSelect, showHoverPopup])

  useEffect(() => {
    const map = mapRef.current
    if (!map || themeRef.current === theme) return

    themeRef.current = theme
    hideHoverPopup()
    map.setStyle(getCartoStyleUrl(theme), {
      diff: false,
      transformStyle: preserveStationStyle,
    })
  }, [theme, hideHoverPopup])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const source = map.getSource('stations') as GeoJSONSource | undefined
    if (source) {
      source.setData(stationsToGeoJSON(stations))
      return
    }

    return onceStyleLoad(map, () => {
      const loadedSource = map.getSource('stations') as GeoJSONSource | undefined
      loadedSource?.setData(stationsToGeoJSON(stations))
    })
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
