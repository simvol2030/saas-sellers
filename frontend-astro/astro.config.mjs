// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Site URL (update for production)
  site: 'http://localhost:4321',

  // Output mode: 'static' for SSG, 'server' for SSR
  output: 'static',

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

  // Experimental features (if needed)
  // experimental: {
  //   contentCollectionCache: true,
  // },
});
