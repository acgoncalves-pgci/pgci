import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { pdfAssets } from './build/pdfAssets'

export default defineConfig({
  plugins: [react(), pdfAssets()],

  server: {
    allowedHosts: [
      '65cb-2804-2424-8300-1390-382f-739b-f571-1958.ngrok-free.app',
    ],
  },

  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
