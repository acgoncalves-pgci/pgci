import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    allowedHosts: [
      'b87a-2804-2424-8300-1390-59b0-6bd-50da-b824.ngrok-free.app',
    ],
  },

  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})