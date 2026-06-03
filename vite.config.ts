import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const QUALICHARGE_API_BASE = 'https://map.qualicharge.beta.gouv.fr'

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api/irve': {
        target: QUALICHARGE_API_BASE,
        changeOrigin: true,
        secure: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api/irve': {
        target: QUALICHARGE_API_BASE,
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
