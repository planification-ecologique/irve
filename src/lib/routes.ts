export const ANALYTICS_PATH = '/analyse'

export function isAnalyticsPath(pathname = window.location.pathname): boolean {
  return pathname === ANALYTICS_PATH || pathname.endsWith(`${ANALYTICS_PATH}/`)
}
