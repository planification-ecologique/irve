import { useCallback, useEffect, useState } from 'react'
import type { SavedTrip } from '../types/trip'

const STORAGE_KEY = 'irve-saved-trips'

function loadTrips(): SavedTrip[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedTrip[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveTrips(trips: SavedTrip[]): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trips))
}

export function useSavedTrips() {
  const [trips, setTrips] = useState<SavedTrip[]>(() => loadTrips())
  const [activeTripId, setActiveTripId] = useState<string | null>(() => loadTrips()[0]?.id ?? null)

  useEffect(() => {
    saveTrips(trips)
  }, [trips])

  const addTrip = useCallback((trip: SavedTrip) => {
    setTrips((current) => [trip, ...current])
    setActiveTripId(trip.id)
  }, [])

  const removeTrip = useCallback((tripId: string) => {
    setTrips((current) => {
      const next = current.filter((trip) => trip.id !== tripId)
      setActiveTripId((active) => {
        if (active !== tripId) return active
        return next[0]?.id ?? null
      })
      return next
    })
  }, [])

  const activeTrip = trips.find((trip) => trip.id === activeTripId) ?? null

  return {
    trips,
    activeTrip,
    activeTripId,
    setActiveTripId,
    addTrip,
    removeTrip,
  }
}
