import { useEffect, useState } from 'react'
import { fetchIrvePoints, POLL_INTERVAL_MS, type IrveDataSource } from '../api/irve'
import { sanitizeIrveResponse } from '../lib/stations'
import type { IrvePointsResponse } from '../types/irve'

interface UseIrveDataResult {
  data: IrvePointsResponse | null
  dataSource: IrveDataSource | null
  lastFetchedAt: Date | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useIrveData(): UseIrveDataResult {
  const [data, setData] = useState<IrvePointsResponse | null>(null)
  const [dataSource, setDataSource] = useState<IrveDataSource | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load(showLoading: boolean) {
      if (showLoading) {
        setLoading(true)
        setError(null)
      }

      try {
        const { data: raw, source } = await fetchIrvePoints()
        if (!cancelled) {
          setData(sanitizeIrveResponse(raw))
          setDataSource(source)
          setLastFetchedAt(new Date())
          if (!showLoading || source === 'live') {
            setError(null)
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (showLoading) {
            setError(err instanceof Error ? err.message : 'Erreur inconnue')
          }
        }
      } finally {
        if (!cancelled && showLoading) {
          setLoading(false)
        }
      }
    }

    void load(true)

    const interval = window.setInterval(() => {
      void load(false)
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [tick])

  return {
    data,
    dataSource,
    lastFetchedAt,
    loading,
    error,
    refetch: () => setTick((value) => value + 1),
  }
}
