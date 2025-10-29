/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: '#1A1A1E',
        surface: '#24242A',
        foreground: '#FFFFFF',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A9A9B8',
        accent: '#FFCE34',
        'accent-secondary': '#6B6BFF',
        // Keep hsl for compatibility
        primary: {
          DEFAULT: '#FFCE34',
          foreground: '#1A1A1E',
        },
        secondary: {
          DEFAULT: '#24242A',
          foreground: '#A9A9B8',
        },
      },
      borderRadius: {
        'card': '20px',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.15)',
        'elevated': '0 4px 12px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
}

