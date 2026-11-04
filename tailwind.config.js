/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5d9e2',
          300: '#b0b8c8',
          400: '#8590a8',
          500: '#67738d',
          600: '#525c73',
          700: '#434b5e',
          800: '#3a4051',
          900: '#1f2330',
          950: '#141720',
        },
        brand: {
          50: '#eef7ff',
          100: '#d9ecff',
          200: '#bcdfff',
          300: '#8ecbff',
          400: '#59adff',
          500: '#338cff',
          600: '#1c6df5',
          700: '#1556e1',
          800: '#1846b6',
          900: '#1a3e8f',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(20,23,32,0.06), 0 1px 2px rgba(20,23,32,0.04)',
        'card-hover': '0 4px 16px rgba(20,23,32,0.08), 0 2px 6px rgba(20,23,32,0.05)',
      },
    },
  },
  plugins: [],
};
