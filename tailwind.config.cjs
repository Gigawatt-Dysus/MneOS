/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gigi-blue': '#003b6f',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'sans-serif'],
        orbitron: ['Orbitron', 'sans-serif'],
        tangerine: ['Tangerine', 'cursive'],
        'mona-sans': ['Mona Sans', 'sans-serif'],
      },
      keyframes: {
        dissolve: {
          '0%': { opacity: '1', transform: 'scale(1)', filter: 'blur(0)' },
          '100%': { opacity: '0', transform: 'scale(0.9)', filter: 'blur(5px)' },
        },
        toastIn: {
          'from': { transform: 'translateX(100%)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1.5) drop-shadow(0 0 15px rgba(0, 240, 255, 0.6))' },
          '50%': { opacity: '0.7', filter: 'brightness(0.9) drop-shadow(0 0 2px rgba(0, 240, 255, 0.1))' },
        },
        scan: {
          '0%': { top: '0%', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { top: '100%', opacity: '0' }
        },
        'mesh-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' }
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' }
        },
        'border-rotate': {
          'from': { '--border-angle': '0turn' },
          'to': { '--border-angle': '1turn' },
        }
      },
      animation: {
        dissolve: 'dissolve 1.5s ease-out forwards',
        toastIn: 'toastIn 0.5s ease-out forwards',
        'pulse-slow': 'pulse-glow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 4s linear infinite',
        'mesh-pan': 'mesh-shift 15s ease infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'border-rotate': 'border-rotate 3s linear infinite',
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}