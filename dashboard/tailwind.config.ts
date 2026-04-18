import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#f8f7f4',
        surface: '#ffffff',
        border: '#e8e3dc',
        primary: {
          DEFAULT: '#1a3a2a',
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: '#c8956c',
          foreground: '#ffffff',
        },
        'text-muted': '#9ca3af',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
