import { useEffect, useRef, useCallback } from 'react'
import maplibregl, { type GeoJSONSource, type Map, type MapMouseEvent } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import type { Station, StationFeatureProperties } from '../types/irve'
import { stationsToGeoJSON } from '../lib/geojson'
import { applyFrenchLabels, getCartoStyleUrl, MAP_LOCALE_FR, preserveStationStyle } from '../lib/mapStyle'
import type { Theme } from '../lib/theme'
import { clusterProperties, mixedClusterColor, mixedClusterOpacity, mixedPointColor, mixedPointOpacity } from '../lib/mapLayers'
import { formatMaxPowerKw } from '../lib/formatPower'
import { getPowerBadgeClass } from '../lib/power'
import { getAvailabilityTone } from '../lib/stationDisplay'

const FRANCE_CENTER: [number, number] = [2.5, 46.6]
const FRANCE_ZOOM = 5.2

export interface RouteOverlay {
  coordinates: [number, number][]
  endpoints: {
    from: { lng: number; lat: number; label: string }
    to: { lng: number; lat: number; label: string }
  }
}

interface IrveMapProps {
  stations: Station[]
  selectedKey: string | null
  onSelect: (station: Station | null) => void
  theme: Theme
  routeOverlay?: RouteOverlay | null
  disableCluster?: boolean
}

function routeToGeoJSON(overlay: RouteOverlay) {
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: overlay.coordinates,
        },
        properties: {},
      },
      {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [overlay.endpoints.from.lng, overlay.endpoints.from.lat],
        },
        properties: { role: 'from', label: overlay.endpoints.from.label },
      },
      {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [overlay.endpoints.to.lng, overlay.endpoints.to.lat],
        },
        properties: { role: 'to', label: overlay.endpoints.to.label },
      },
    ],
  }
}

function addRouteLayers(map: Map, overlay: RouteOverlay) {
  if (map.getSource('route')) return

  map.addSource('route', {
    type: 'geojson',
    data: routeToGeoJSON(overlay),
  })

  map.addLayer({
    id: 'route-line-glow',
    type: 'line',
    source: 'route',
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: {
      'line-color': '#000091',
      'line-width': 8,
      'line-opacity': 0.15,
      'line-blur': 2,
    },
  })

  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#000091',
      'line-width': 4,
      'line-opacity': 0.85,
    },
  })

  map.addLayer({
    id: 'route-endpoints',
    type: 'circle',
    source: 'route',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-color': [
        'match',
        ['get', 'role'],
        'from',
        '#22c55e',
        'to',
        '#ef4444',
        '#000091',
      ],
      'circle-radius': 7,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  })
}

function syncRouteOverlay(map: Map, overlay: RouteOverlay | null | undefined) {
  const source = map.getSource('route') as GeoJSONSource | undefined

  if (!overlay) {
    if (source) {
      ;['route-endpoints', 'route-line', 'route-line-glow'].forEach((layerId) => {
        if (map.getLayer(layerId)) map.removeLayer(layerId)
      })
      map.removeSource('route')
    }
    return
  }

  if (source) {
    source.setData(routeToGeoJSON(overlay))
    return
  }

  addRouteLayers(map, overlay)
}

function fitRouteBounds(map: Map, overlay: RouteOverlay) {
  const bounds = new maplibregl.LngLatBounds()
  for (const [lng, lat] of overlay.coordinates) {
    bounds.extend([lng, lat])
  }
  map.fitBounds(bounds, { padding: 72, maxZoom: 10, duration: 800 })
}

function addStationLayers(map: Map, stations: Station[], disableCluster: boolean) {
  if (map.getSource('stations')) return

  map.addSource('stations', {
    type: 'geojson',
    data: stationsToGeoJSON(stations),
    cluster: !disableCluster,
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
      'circle-color': '#000091',
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
      'circle-color': '#000091',
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

function setupMapStyle(
  map: Map,
  stations: Station[],
  disableCluster: boolean,
  routeOverlay?: RouteOverlay | null,
) {
  applyFrenchLabels(map)

  const source = map.getSource('stations') as GeoJSONSource | undefined
  if (source) {
    source.setData(stationsToGeoJSON(stations))
    syncRouteOverlay(map, routeOverlay)
    return
  }

  addStationLayers(map, stations, disableCluster)
  syncRouteOverlay(map, routeOverlay)
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

export function IrveMap({
  stations,
  selectedKey,
  onSelect,
  theme,
  routeOverlay = null,
  disableCluster = false,
}: IrveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const themeRef = useRef(theme)
  const stationsRef = useRef(stations)
  const selectedKeyRef = useRef(selectedKey)
  const routeOverlayRef = useRef(routeOverlay)
  const disableClusterRef = useRef(disableCluster)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const hoveredKeyRef = useRef<string | null>(null)

  stationsRef.current = stations
  selectedKeyRef.current = selectedKey
  routeOverlayRef.current = routeOverlay
  disableClusterRef.current = disableCluster

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
            <span class="map-popup__power ${powerClass}">${formatMaxPowerKw(props.max_power)}</span>
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
      setupMapStyle(
        map,
        stationsRef.current,
        disableClusterRef.current,
        routeOverlayRef.current,
      )
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

    const apply = () => {
      setupMapStyle(map, stations, disableCluster, routeOverlay)
    }

    const source = map.getSource('stations') as GeoJSONSource | undefined
    if (source) {
      apply()
      return
    }

    return onceStyleLoad(map, apply)
  }, [stations, disableCluster, routeOverlay])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !routeOverlay) return
    fitRouteBounds(map, routeOverlay)
  }, [routeOverlay])

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
