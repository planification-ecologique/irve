import { useEffect, useState } from 'react'

interface StationContactsFile {
  contacts: Record<string, string | null>
}

/** `undefined` = chargement, `null` = fichier absent, `Map` = prêt. */
export function useStationContactCache(
  enabled: boolean,
): Map<string, string | null> | null | undefined {
  const [contacts, setContacts] = useState<Map<string, string | null> | null | undefined>(
    undefined,
  )

  useEffect(() => {
    if (!enabled) {
      setContacts(null)
      return
    }

    let cancelled = false
    setContacts(undefined)

    void fetch('/data/station-contacts.json')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: StationContactsFile | null) => {
        if (cancelled) return
        if (!data?.contacts) {
          setContacts(null)
          return
        }
        setContacts(new Map(Object.entries(data.contacts)))
      })
      .catch(() => {
        if (!cancelled) setContacts(null)
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return contacts
}
