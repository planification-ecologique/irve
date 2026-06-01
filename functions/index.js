const { onRequest } = require('firebase-functions/v2/https')

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
