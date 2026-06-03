import { useEffect, useRef, useState } from 'react'
import {
  submitFeedback,
  type FeedbackAuthorType,
  type FeedbackReason,
} from '../api/feedback'

interface FeedbackFormProps {
  /** Borne concernée (`id_station_itinerance`), si le retour est contextuel. */
  stationId?: string
  /** Libellé station affiché en en-tête pour rassurer l'utilisateur. */
  stationName?: string
  onClose: () => void
}

const REASON_OPTIONS: { value: FeedbackReason; label: string }[] = [
  { value: 'donnee_fausse', label: 'Donnée fausse' },
  { value: 'bug', label: 'Bug' },
  { value: 'suggestion', label: 'Suggestion' },
]

const AUTHOR_OPTIONS: { value: FeedbackAuthorType; label: string }[] = [
  { value: 'utilisateur', label: 'Utilisateur' },
  { value: 'operateur', label: 'Opérateur' },
]

export function FeedbackForm({ stationId, stationName, onClose }: FeedbackFormProps) {
  const [reason, setReason] = useState<FeedbackReason>('donnee_fausse')
  const [authorType, setAuthorType] = useState<FeedbackAuthorType>('utilisateur')
  const [comment, setComment] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!comment.trim() || status === 'sending') return

    setStatus('sending')
    setErrorMessage(null)

    const result = await submitFeedback({
      raison: reason,
      type: authorType,
      commentaire: comment.trim(),
      email: email.trim() || undefined,
      id_station: stationId,
      website,
    })

    if (result.ok) {
      setStatus('success')
    } else {
      setStatus('error')
      setErrorMessage(result.error ?? 'Envoi impossible pour le moment.')
    }
  }

  return (
    <div
      className="feedback-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Signaler un problème"
    >
      <button
        type="button"
        className="feedback-overlay__backdrop"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="feedback-modal">
        <button
          type="button"
          className="feedback-modal__close"
          onClick={onClose}
          aria-label="Fermer"
        >
          ×
        </button>

        <h2 className="feedback-modal__title">Signaler un problème</h2>
        {stationName && <p className="feedback-modal__station">{stationName}</p>}

        {status === 'success' ? (
          <div className="feedback-modal__success">
            <p>Merci&nbsp;! Votre signalement a bien été transmis.</p>
            <button type="button" className="feedback-modal__submit" onClick={onClose}>
              Fermer
            </button>
          </div>
        ) : (
          <form className="feedback-form" onSubmit={handleSubmit}>
            <div className="field">
              <span>Nature du signalement</span>
              <div className="chip-group">
                {REASON_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`chip${reason === option.value ? ' chip--active' : ''}`}
                    onClick={() => setReason(option.value)}
                    aria-pressed={reason === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>Vous êtes</span>
              <select
                value={authorType}
                onChange={(event) => setAuthorType(event.target.value as FeedbackAuthorType)}
              >
                {AUTHOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Votre message</span>
              <textarea
                ref={textareaRef}
                className="feedback-form__textarea"
                value={comment}
                maxLength={2000}
                rows={4}
                placeholder="Décrivez le problème ou votre suggestion…"
                onChange={(event) => setComment(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>E-mail (optionnel)</span>
              <input
                type="email"
                value={email}
                placeholder="pour vous recontacter si besoin"
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            {/* Honeypot anti-spam : masqué, ne pas remplir. */}
            <div className="feedback-form__honeypot" aria-hidden="true">
              <label>
                Ne pas remplir
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </label>
            </div>

            {status === 'error' && errorMessage && (
              <p className="feedback-form__error">{errorMessage}</p>
            )}

            <p className="feedback-form__notice">
              Aucune donnée personnelle n’est requise. Si vous renseignez un e-mail, il
              servira uniquement au suivi de votre signalement.
            </p>

            <button
              type="submit"
              className="feedback-modal__submit"
              disabled={!comment.trim() || status === 'sending'}
            >
              {status === 'sending' ? 'Envoi…' : 'Envoyer'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
