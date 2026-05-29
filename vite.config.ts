import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/irve': {
        target: 'https://qualicharge-carto.osc-fr1.scalingo.io',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api/irve': {
        target: 'https://qualicharge-carto.osc-fr1.scalingo.io',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
