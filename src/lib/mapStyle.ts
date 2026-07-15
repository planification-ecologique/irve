import type { Map, StyleSpecification } from 'maplibre-gl'
import type { Theme } from './theme'

export const CARTO_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

export const CARTO_STYLE_URL_DARK =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

export function getCartoStyleUrl(theme: Theme): string {
  return theme === 'dark' ? CARTO_STYLE_URL_DARK : CARTO_STYLE_URL
}

// --- Fond de carte de secours -------------------------------------------
//
// Sur certains réseaux (proxy d'inspection SSL des postes SPM, par ex.) les
// réponses du CDN Carto sont ré-émises sans en-tête `Access-Control-Allow-Origin`.
// MapLibre charge tuiles vectorielles ET glyphes via fetch/XHR : tout échoue
// alors en CORS et le fond reste vide. On bascule dans ce cas vers un fond
// raster servi par la Géoplateforme de l'IGN (service de l'État, sans clé),
// très généralement accessible depuis les réseaux gouvernementaux.

/** Tuiles raster « Plan IGN v2 » (Géoplateforme, WMTS, sans clé d'accès). */
export const IGN_PLAN_TILES_URL =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
  '&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM' +
  '&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'

/**
 * Glyphes déclarés pour le calque `cluster-count`. Sur le réseau qui bloque
 * Carto, ce fetch échoue aussi mais MapLibre rend alors les chiffres en local
 * (cf. « Rendering codepoint locally instead ») : les numéros restent lisibles.
 */
const FALLBACK_GLYPHS_URL = 'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf'

/** Clé localStorage : mémorise qu'un poste doit démarrer directement sur l'IGN. */
export const BASEMAP_FALLBACK_STORAGE_KEY = 'irve-basemap-fallback'

export function isBasemapFallbackPreferred(): boolean {
  try {
    return localStorage.getItem(BASEMAP_FALLBACK_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberBasemapFallback(): void {
  try {
    localStorage.setItem(BASEMAP_FALLBACK_STORAGE_KEY, '1')
  } catch {
    // localStorage indisponible — la bascule restera valable pour cette session.
  }
}

/** Détecte une erreur de chargement imputable au fond Carto (CORS / réseau). */
export function isCartoBasemapError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { url, message } = error as { url?: string; message?: string }
  return `${url ?? ''} ${message ?? ''}`.includes('cartocdn.com')
}

/** Style raster minimal sur fond IGN, prêt à recevoir les calques stations. */
export function buildRasterFallbackStyle(theme: Theme): StyleSpecification {
  const dark = theme === 'dark'

  return {
    version: 8,
    glyphs: FALLBACK_GLYPHS_URL,
    sources: {
      'ign-plan': {
        type: 'raster',
        tiles: [IGN_PLAN_TILES_URL],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: '© IGN-F / Géoplateforme',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': dark ? '#0b0e14' : '#eaeaea' },
      },
      {
        id: 'ign-plan',
        type: 'raster',
        source: 'ign-plan',
        // En thème sombre, l'IGN n'a pas de variante : on assombrit le raster.
        paint: dark
          ? {
              'raster-brightness-max': 0.55,
              'raster-saturation': -0.35,
              'raster-contrast': -0.05,
              'raster-opacity': 0.92,
            }
          : {},
      },
    ],
  }
}

const STATION_LAYER_IDS = new Set([
  'cluster-glow',
  'clusters',
  'cluster-count',
  'unclustered-point',
  'unclustered-point-glow',
])

const ROUTE_LAYER_IDS = new Set([
  'route-line-glow',
  'route-line',
  'route-endpoints',
  'route-highlight-glow',
  'route-highlight-point',
])

/** Conserve source + calques stations lors d'un swap de fond de carte. */
export function preserveStationStyle(
  previousStyle: StyleSpecification | undefined,
  nextStyle: StyleSpecification,
): StyleSpecification {
  const stationsSource = previousStyle?.sources?.stations
  const routeSource = previousStyle?.sources?.route
  const routeHighlightSource = previousStyle?.sources?.['route-highlight']
  if (!stationsSource && !routeSource && !routeHighlightSource) return nextStyle

  const preservedLayers = previousStyle.layers.filter(
    (layer) => STATION_LAYER_IDS.has(layer.id) || ROUTE_LAYER_IDS.has(layer.id),
  )

  return {
    ...nextStyle,
    sources: {
      ...nextStyle.sources,
      ...(stationsSource ? { stations: stationsSource } : {}),
      ...(routeSource ? { route: routeSource } : {}),
      ...(routeHighlightSource ? { 'route-highlight': routeHighlightSource } : {}),
    },
    layers: [...nextStyle.layers, ...preservedLayers],
  }
}

/** Priorité labels français, repli sur nom local. */
export const FRENCH_NAME_FIELD = [
  'coalesce',
  ['get', 'name:fr'],
  ['get', 'name_fr'],
  ['get', 'name'],
] as const

export const MAP_LOCALE_FR = {
  'AttributionControl.ToggleAttribution': 'Afficher/masquer l’attribution',
  'AttributionControl.MapFeedback': 'Commentaires sur la carte',
  'FullscreenControl.Enter': 'Plein écran',
  'FullscreenControl.Exit': 'Quitter le plein écran',
  'GeolocateControl.FindMyLocation': 'Me localiser',
  'GeolocateControl.LocationNotAvailable': 'Position indisponible',
  'LogoControl.Title': 'Logo MapLibre',
  'Map.Title': 'Carte',
  'NavigationControl.ResetBearing': 'Réinitialiser l’orientation',
  'NavigationControl.ZoomIn': 'Zoom avant',
  'NavigationControl.ZoomOut': 'Zoom arrière',
  'ScrollZoomBlocker.CtrlMessage': 'Ctrl + molette pour zoomer',
  'ScrollZoomBlocker.CmdMessage': '⌘ + molette pour zoomer',
  'TouchPanBlocker.Message': 'Deux doigts pour déplacer la carte',
} as const

function usesEnglishName(value: string): boolean {
  return value === '{name_en}' || value === 'name_en' || value.includes('{name_en}')
}

/** Zoom/function stops only accept format strings — not expression arrays. */
function toFrenchNameStopValue(value: unknown): unknown {
  if (typeof value === 'string' && usesEnglishName(value)) {
    return '{name:fr}'
  }
  if (Array.isArray(value) && value[0] === 'coalesce') {
    return '{name:fr}'
  }
  return value
}

export function toFrenchNameField(value: unknown): unknown {
  if (typeof value === 'string') {
    if (usesEnglishName(value)) {
      return [...FRENCH_NAME_FIELD]
    }
    return value
  }

  if (Array.isArray(value)) {
    if (value[0] === 'get' && (value[1] === 'name_en' || value[1] === 'name:en')) {
      return [...FRENCH_NAME_FIELD]
    }
    return value.map((entry) => toFrenchNameField(entry))
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>

    if ('stops' in record && Array.isArray(record.stops)) {
      return {
        ...record,
        stops: record.stops.map((stop) => {
          if (!Array.isArray(stop)) return stop
          return [stop[0], toFrenchNameStopValue(stop[1])]
        }),
      }
    }

    const next: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(record)) {
      next[key] = toFrenchNameField(entry)
    }
    return next
  }

  return value
}

export function localizeStyleToFrench(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (layer.type !== 'symbol' || !('layout' in layer) || !layer.layout?.['text-field']) {
        return layer
      }

      return {
        ...layer,
        layout: {
          ...layer.layout,
          'text-field': toFrenchNameField(layer.layout['text-field']) as typeof layer.layout['text-field'],
        },
      }
    }),
  }
}

/** Applique les labels FR sur une carte déjà chargée. */
export function applyFrenchLabels(map: Map) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue

    const textField = layer.layout?.['text-field']
    if (!textField) continue

    try {
      map.setLayoutProperty(
        layer.id,
        'text-field',
        toFrenchNameField(textField) as string,
      )
    } catch {
      // Certains calques peuvent refuser la mise à jour — on ignore.
    }
  }
}
