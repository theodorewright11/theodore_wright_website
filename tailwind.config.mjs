/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        display: ['Fraunces', '"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        paper: '#f7f3ec',
        'paper-edge': '#efe9dd',
        ink: '#1a1614',
        'ink-soft': '#3a342c',
        muted: '#7a7166',
        rule: '#d9d0bf',
        'rule-soft': '#e6dfcf',
        accent: '#8a4a2b',
        'accent-soft': '#c98a6e',
        primary: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#748ffc',
          500: '#5c7cfa',
          600: '#4c6ef5',
          700: '#4263eb',
          800: '#3b5bdb',
          900: '#364fc7',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
