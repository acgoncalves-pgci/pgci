/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { ink: '#162B3C', public: { 50: 'color-mix(in srgb, var(--ui-accent) 8%, white)', 100: 'color-mix(in srgb, var(--ui-accent) 16%, white)', 600: 'var(--ui-accent-text)', 700: 'var(--ui-accent-text)', 800: 'var(--ui-accent-text)' } },
      boxShadow: { panel: '0 1px 2px rgba(15, 43, 60, .06), 0 8px 24px rgba(15, 43, 60, .04)' }
    }
  },
  plugins: []
}

