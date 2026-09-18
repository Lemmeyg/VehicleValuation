/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'caret-nudge': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(5px)' },
        },
        'ring-pulse': {
          '0%': { boxShadow: '0 0 0 0 rgba(5,150,105,0.32)' },
          '70%': { boxShadow: '0 0 0 9px rgba(5,150,105,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(5,150,105,0)' },
        },
      },
      animation: {
        'caret-nudge': 'caret-nudge 1.3s ease-in-out infinite',
        'ring-pulse': 'ring-pulse 2s ease-out infinite',
      },
    },
  },
  plugins: [],
}
