import { useCallback, useState } from 'react'
import { applyTheme, getStoredTheme, persistTheme, type Theme } from '../lib/theme'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme())

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    persistTheme(next)
    applyTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === 'light' ? 'dark' : 'light'
      persistTheme(next)
      applyTheme(next)
      return next
    })
  }, [])

  return { theme, setTheme, toggleTheme }
}
