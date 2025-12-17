// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import svelte from '@astrojs/svelte';

// https://astro.build/config
export default defineConfig({
  // Site URL (update for production)
  site: 'http://localhost:4321',

  // Server mode for SSR (admin pages)
  // Static pages use `export const prerender = true`
  output: 'server',

  // Node.js adapter for SSR
  adapter: node({
    mode: 'standalone',
  }),

  // Integrations
  integrations: [
    svelte(),
  ],

  // Build options
  build: {
    // Inline stylesheets smaller than 4KB
    inlineStylesheets: 'auto',
  },

  // Vite configuration
  vite: {
    // Environment variables
    envPrefix: 'PUBLIC_',
  },

  // Markdown options
  markdown: {
    // Syntax highlighting
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },

  // Dev server
  server: {
    port: 4321,
    host: true,
  },
});
