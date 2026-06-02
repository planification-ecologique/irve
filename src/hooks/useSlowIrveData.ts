import { useEffect, useState } from 'react'
import { fetchSlowIrveStations } from '../api/transportIrve'
import { sanitizeIrveResponse } from '../lib/stations'
import type { IrvePointsResponse } from '../types/irve'

interface UseSlowIrveDataResult {
  data: IrvePointsResponse | null
  loading: boolean
  error: string | null
}

export function useSlowIrveData(enabled: boolean): UseSlowIrveDataResult {
  const [data, setData] = useState<IrvePointsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void fetchSlowIrveStations()
      .then((raw) => {
        if (!cancelled) {
          setData(sanitizeIrveResponse(raw))
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur inconnue')
          setData(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return { data, loading, error }
}
