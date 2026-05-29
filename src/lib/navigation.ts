function isAppleDevice(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
}

function isAndroidDevice(): boolean {
  return /Android/.test(navigator.userAgent)
}

export function openNavigationApp(lat: number, lng: number, label?: string): void {
  const trimmedLabel = label?.trim()

  if (isAppleDevice()) {
    window.location.href = `maps://?daddr=${lat},${lng}&dirflg=d`
    return
  }

  if (isAndroidDevice()) {
    const query = trimmedLabel
      ? `${lat},${lng}(${encodeURIComponent(trimmedLabel)})`
      : `${lat},${lng}`
    window.location.href = `geo:0,0?q=${query}`
    return
  }

  const destination = trimmedLabel
    ? `${lat},${lng}(${encodeURIComponent(trimmedLabel)})`
    : `${lat},${lng}`
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank', 'noopener')
}
