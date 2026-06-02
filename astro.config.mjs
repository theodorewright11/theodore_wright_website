import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://theodorewright.dev',
  integrations: [
    mdx(),
    react(),
    tailwind(),
    sitemap(),
  ],
  redirects: {
    '/about': '/',
  },
  // Google Identity Services silent token refresh opens a popup and polls
  // `window.closed` on it. A restrictive COOP header severs that handle, so GIS
  // reports `popup_closed` and silent refresh fails — which is why the dashboards
  // forced a manual re-sign-in roughly every hour. `same-origin-allow-popups`
  // keeps GIS popups in the opener's browsing-context group while still isolating
  // the page from being opened by others. (Production needs the same header —
  // see ARCHITECTURE.md "Auth / COOP".)
  vite: {
    server: {
      headers: { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' },
    },
    preview: {
      headers: { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' },
    },
  },
});
