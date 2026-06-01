import { useEffect, useState } from 'react'
import { fetchStationDetail } from '../api/irve'
import type { StationDetail } from '../types/irve'

interface UseStationDetailResult {
  detail: StationDetail | null
  loading: boolean
}

export function useStationDetail(stationId: string): UseStationDetailResult {
  const [detail, setDetail] = useState<StationDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDetail(null)

    void fetchStationDetail(stationId).then((result) => {
      if (!cancelled) {
        setDetail(result)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [stationId])

  return { detail, loading }
}
