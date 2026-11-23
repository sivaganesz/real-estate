/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
      colors: {
        brand: {
          50: '#effaf8', 100: '#d7f2ed', 200: '#b0e4da', 300: '#7dcfc1', 400: '#4bb3a5',
          500: '#2a978a', 600: '#1d7a70', 700: '#0f766e', 800: '#145c56', 900: '#134c47',
        },
        ai: { 50: '#f4f3ff', 100: '#ebe9fe', 200: '#d9d6fe', 500: '#7c6cf2', 600: '#6a4fe6', 700: '#5a3fcf' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.06)',
        pop: '0 12px 32px -8px rgba(16,24,40,.18), 0 4px 8px -4px rgba(16,24,40,.08)',
      },
    },
  },
  plugins: [],
};
