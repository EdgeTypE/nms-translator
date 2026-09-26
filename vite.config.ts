import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';

// Every route is a real static document (GitHub Pages serves directory
// indexes), each pointing at the same bundle. SEO sees distinct HTML per
// route; the client still navigates instantly via the History API.
const pageInputs = [
  resolve(import.meta.dirname, 'index.html'),
  resolve(import.meta.dirname, 'phrasebook/index.html'),
  resolve(import.meta.dirname, 'archive/index.html'),
  resolve(import.meta.dirname, 'npc/index.html'),
];

export default defineConfig({
  // Absolute base: required because pages live at different path depths.
  base: '/',
  plugins: [svelte()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: pageInputs,
    },
  },
});
