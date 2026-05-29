export function formatRelativeMinutes(date: Date, now = Date.now()): string {
  const minutes = Math.floor((now - date.getTime()) / 60_000)

  if (minutes < 1) return 'à l’instant'
  if (minutes === 1) return 'il y a 1 min'
  return `il y a ${minutes} min`
}
