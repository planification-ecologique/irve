const base = import.meta.env.BASE_URL.replace(/\/$/, '')

export const ANALYTICS_PATH = `${base}/analyse`

export function isAnalyticsPath(pathname = window.location.pathname): boolean {
  return pathname === ANALYTICS_PATH || pathname.endsWith(`${ANALYTICS_PATH}/`)
}
