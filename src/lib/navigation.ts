export type NavigationProvider = 'default' | 'google-maps' | 'cartes-app'

export const NAVIGATION_STORAGE_KEY = 'irve-navigation-provider'

function isAppleDevice(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
}

function isAndroidDevice(): boolean {
  return /Android/.test(navigator.userAgent)
}

export function getStoredNavigationProvider(): NavigationProvider | null {
  try {
    const stored = localStorage.getItem(NAVIGATION_STORAGE_KEY)
    if (stored === 'default' || stored === 'google-maps' || stored === 'cartes-app') {
      return stored
    }
    if (stored === 'apple-maps') {
      return 'cartes-app'
    }
  } catch {
    // localStorage indisponible (SSR, mode privé strict)
  }
  return null
}

export function persistNavigationProvider(provider: NavigationProvider): void {
  try {
    localStorage.setItem(NAVIGATION_STORAGE_KEY, provider)
  } catch {
    // ignore
  }
}

function formatGoogleDestination(lat: number, lng: number): string {
  return `${lat},${lng}`
}

function formatGeoQuery(lat: number, lng: number, label?: string): string {
  const trimmedLabel = label?.trim()
  if (trimmedLabel) {
    return `${lat},${lng}(${encodeURIComponent(trimmedLabel)})`
  }
  return `${lat},${lng}`
}

export function buildNavigationUrl(
  provider: NavigationProvider,
  lat: number,
  lng: number,
  label?: string,
): string {
  if (provider === 'google-maps') {
    const destination = encodeURIComponent(formatGoogleDestination(lat, lng))
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`
  }

  if (provider === 'cartes-app') {
    const name = (label?.trim() || 'Station IRVE').replace(/\|/g, ' ')
    const allez = `->${name}||${lng.toFixed(5)}|${lat.toFixed(5)}`
    return `https://cartes.app/?allez=${encodeURIComponent(allez)}&geoloc=0&mode=voiture`
  }

  if (isAppleDevice()) {
    return `maps://?daddr=${lat},${lng}&dirflg=d`
  }

  if (isAndroidDevice()) {
    return `geo:0,0?q=${formatGeoQuery(lat, lng, label)}`
  }

  const destination = encodeURIComponent(formatGoogleDestination(lat, lng))
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`
}

export function openNavigationApp(
  lat: number,
  lng: number,
  label?: string,
  provider?: NavigationProvider,
): void {
  const resolvedProvider = provider ?? getStoredNavigationProvider() ?? 'default'
  const url = buildNavigationUrl(resolvedProvider, lat, lng, label)

  if (url.startsWith('http')) {
    window.open(url, '_blank', 'noopener')
    return
  }

  window.location.href = url
}

export const NAVIGATION_PROVIDER_OPTIONS: {
  id: NavigationProvider
  label: string
  description: string
}[] = [
  {
    id: 'default',
    label: 'App par défaut',
    description: 'Ouvre l’app cartes de votre appareil',
  },
  {
    id: 'google-maps',
    label: 'Google Maps',
    description: 'Itinéraire dans Google Maps',
  },
  {
    id: 'cartes-app',
    label: 'Cartes.app',
    description: 'Itinéraire open source sur cartes.app',
  },
]
