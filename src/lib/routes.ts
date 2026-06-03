const base = import.meta.env.BASE_URL.replace(/\/$/, '')

export const MAP_PATH = base || '/'
export const ANALYTICS_PATH = `${base}/analyse`
export const TARIFFS_PATH = `${base}/tarifs`

export function navigate(path: string): void {
  if (window.location.pathname === path) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function isAnalyticsPath(pathname = window.location.pathname): boolean {
  return pathname === ANALYTICS_PATH || pathname.endsWith(`${ANALYTICS_PATH}/`)
}

export function isTariffsPath(pathname = window.location.pathname): boolean {
  return pathname === TARIFFS_PATH || pathname.endsWith(`${TARIFFS_PATH}/`)
}

export type AppPage = 'map' | 'analytics' | 'tariffs'

export function getAppPage(pathname = window.location.pathname): AppPage {
  if (isAnalyticsPath(pathname)) return 'analytics'
  if (isTariffsPath(pathname)) return 'tariffs'
  return 'map'
}
