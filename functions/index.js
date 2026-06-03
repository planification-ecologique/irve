const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret, defineString } = require('firebase-functions/params')

const API_BASE = 'https://map.qualicharge.beta.gouv.fr'

exports.irveProxy = onRequest(
  {
    region: 'europe-west1',
    cors: true,
    maxInstances: 10,
    invoker: 'public',
  },
  async (req, res) => {
    const path = req.path.startsWith('/api/irve')
      ? req.path
      : `/api/irve${req.path}`

    const url = `${API_BASE}${path}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`

    try {
      const response = await fetch(url, {
        method: req.method,
        headers: {
          Accept: 'application/json',
        },
      })

      const body = await response.text()

      res.status(response.status)
      res.set('Content-Type', response.headers.get('content-type') || 'application/json')
      res.set('Cache-Control', 'public, max-age=120')
      res.send(body)
    } catch {
      res.status(502).json({ error: 'Impossible de joindre l’API QualiCharge' })
    }
  },
)

// --- Remontée d'information (feedback) -> Grist ---------------------------

// Clé API Grist (secret, jamais exposée au navigateur) :
//   firebase functions:secrets:set GRIST_API_KEY
const GRIST_API_KEY = defineSecret('GRIST_API_KEY')

// Configuration de l'instance / document Grist (non sensibles, surchargables
// via .env ou variables de build). Valeurs par défaut = doc « liste-irve »
// de l'organisation planification-ecologique sur grist.numerique.gouv.fr.
const GRIST_BASE_URL = defineString('GRIST_BASE_URL', {
  default: 'https://grist.numerique.gouv.fr',
})
const GRIST_DOC_ID = defineString('GRIST_DOC_ID', { default: 'd9kzew5E2XNQSnfp5Fj9D4' })
const GRIST_TABLE_ID = defineString('GRIST_TABLE_ID', { default: 'Commentaires' })

const FEEDBACK_REASONS = new Set(['bug', 'suggestion', 'donnee_fausse'])
const FEEDBACK_AUTHOR_TYPES = new Set(['utilisateur', 'operateur'])

const MAX_COMMENT_LENGTH = 2000
const MAX_EMAIL_LENGTH = 200
const MAX_STATION_ID_LENGTH = 100

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Rate-limit best-effort en mémoire d'instance : 5 envois / 10 min / IP.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 5
const rateLimitHits = new Map()

function isRateLimited(ip) {
  const now = Date.now()
  const hits = (rateLimitHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  hits.push(now)
  rateLimitHits.set(ip, hits)
  return hits.length > RATE_LIMIT_MAX
}

function asTrimmedString(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

exports.submitFeedback = onRequest(
  {
    region: 'europe-west1',
    cors: true,
    maxInstances: 5,
    invoker: 'public',
    secrets: [GRIST_API_KEY],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Méthode non autorisée' })
      return
    }

    const body = typeof req.body === 'object' && req.body ? req.body : {}

    // Honeypot anti-spam : champ invisible côté UI, rempli par les bots.
    if (asTrimmedString(body.website, 100)) {
      // On répond 200 pour ne pas signaler au bot que le piège a fonctionné.
      res.status(200).json({ ok: true })
      return
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown'
    if (isRateLimited(String(ip))) {
      res.status(429).json({ error: 'Trop de signalements, réessayez plus tard.' })
      return
    }

    const reason = asTrimmedString(body.raison, 50)
    const authorType = asTrimmedString(body.type, 50) || 'utilisateur'
    const comment = asTrimmedString(body.commentaire, MAX_COMMENT_LENGTH)
    const email = asTrimmedString(body.email, MAX_EMAIL_LENGTH)
    const stationId = asTrimmedString(body.id_station, MAX_STATION_ID_LENGTH)

    if (!FEEDBACK_REASONS.has(reason)) {
      res.status(400).json({ error: 'Type de signalement invalide.' })
      return
    }
    if (!FEEDBACK_AUTHOR_TYPES.has(authorType)) {
      res.status(400).json({ error: 'Auteur invalide.' })
      return
    }
    if (!comment) {
      res.status(400).json({ error: 'Le commentaire est obligatoire.' })
      return
    }
    if (email && !EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Adresse e-mail invalide.' })
      return
    }

    const fields = {
      date: new Date().toISOString(),
      type: authorType,
      raison: reason,
      commentaire: comment,
      email: email || null,
      id_station: stationId || null,
      status: 'nouveau',
    }

    const url = `${GRIST_BASE_URL.value()}/api/docs/${GRIST_DOC_ID.value()}/tables/${GRIST_TABLE_ID.value()}/records`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GRIST_API_KEY.value()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records: [{ fields }] }),
      })

      if (!response.ok) {
        const detail = await response.text()
        console.error('Grist a refusé le signalement', response.status, detail)
        res.status(502).json({ error: 'Enregistrement impossible pour le moment.' })
        return
      }

      res.status(201).json({ ok: true })
    } catch (err) {
      console.error('Erreur lors de l’envoi vers Grist', err)
      res.status(502).json({ error: 'Enregistrement impossible pour le moment.' })
    }
  },
)
