/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { ink: '#162B3C', public: { 50: '#eef6fb', 100: '#d8eaf5', 600: '#17628b', 700: '#104d70', 800: '#0e3c58' } },
      boxShadow: { panel: '0 1px 2px rgba(15, 43, 60, .06), 0 8px 24px rgba(15, 43, 60, .04)' }
    }
  },
  plugins: []
}

