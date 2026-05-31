export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'irve-theme'

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage indisponible (SSR, mode privé strict)
  }
  return 'light'
}

export function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.dataset.theme = 'dark'
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

export function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // ignore
  }
}
