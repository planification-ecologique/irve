import type { Map, StyleSpecification } from 'maplibre-gl'

export const CARTO_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

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
          return [stop[0], toFrenchNameField(stop[1])]
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
