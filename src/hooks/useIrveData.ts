import { useEffect, useRef, useState } from 'react'
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

export function useIrveData(enabled = true): UseIrveDataResult {
  const [data, setData] = useState<IrvePointsResponse | null>(null)
  const [dataSource, setDataSource] = useState<IrveDataSource | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const lastFetchedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    let cancelled = false
    let intervalId: ReturnType<typeof window.setInterval> | undefined

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
          const fetchedAt = new Date()
          setLastFetchedAt(fetchedAt)
          lastFetchedAtRef.current = fetchedAt.getTime()
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

    function stopPolling() {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
        intervalId = undefined
      }
    }

    function startPolling() {
      stopPolling()
      if (document.visibilityState !== 'visible') return
      intervalId = window.setInterval(() => {
        void load(false)
      }, POLL_INTERVAL_MS)
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        stopPolling()
        return
      }

      const lastMs = lastFetchedAtRef.current
      if (lastMs === null || Date.now() - lastMs >= POLL_INTERVAL_MS) {
        void load(false)
      }
      startPolling()
    }

    void load(true)
    startPolling()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      stopPolling()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [tick, enabled])

  return {
    data,
    dataSource,
    lastFetchedAt,
    loading,
    error,
    refetch: () => setTick((value) => value + 1),
  }
}
