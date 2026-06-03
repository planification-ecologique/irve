/** Catégorie du signalement (colonne `raison` dans Grist). */
export type FeedbackReason = 'bug' | 'suggestion' | 'donnee_fausse'

/** Qui signale (colonne `type` dans Grist). */
export type FeedbackAuthorType = 'utilisateur' | 'operateur'

export interface FeedbackPayload {
  raison: FeedbackReason
  type: FeedbackAuthorType
  commentaire: string
  /** E-mail optionnel pour le suivi. */
  email?: string
  /** `id_station_itinerance` quand le retour cible une borne précise. */
  id_station?: string
  /** Honeypot anti-spam : doit rester vide. */
  website?: string
}

const FEEDBACK_URL = '/api/feedback'

export interface FeedbackResult {
  ok: boolean
  error?: string
}

export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResult> {
  try {
    const response = await fetch(FEEDBACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      return { ok: true }
    }

    const data = (await response.json().catch(() => null)) as { error?: string } | null
    return { ok: false, error: data?.error ?? 'Envoi impossible pour le moment.' }
  } catch {
    return { ok: false, error: 'Réseau indisponible. Réessayez plus tard.' }
  }
}
