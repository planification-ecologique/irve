import { useEffect, useState } from 'react'
import { fetchIrvePoints } from '../api/irve'
import type { IrvePointsResponse } from '../types/irve'

interface UseIrveDataResult {
  data: IrvePointsResponse | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useIrveData(): UseIrveDataResult {
  const [data, setData] = useState<IrvePointsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetchIrvePoints()
        if (!cancelled) {
          setData(response)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur inconnue')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [tick])

  return {
    data,
    loading,
    error,
    refetch: () => setTick((value) => value + 1),
  }
}
