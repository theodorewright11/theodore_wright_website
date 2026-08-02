/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        display: ['"Bricolage Grotesque"', '"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Tokens resolve to CSS variables (RGB channel triples) so the whole
        // site can swap palettes via `data-theme` on <html>. Channel form keeps
        // Tailwind's opacity utilities (bg-accent/5, bg-paper-edge/50) working.
        // Palettes live in src/styles/global.css.
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        'paper-edge': 'rgb(var(--color-paper-edge) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--color-ink-soft) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        rule: 'rgb(var(--color-rule) / <alpha-value>)',
        'rule-soft': 'rgb(var(--color-rule-soft) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--color-accent-soft) / <alpha-value>)',
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
