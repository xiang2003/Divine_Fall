import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` makes every built URL relative, so the same build works at the
// site root, on a GitHub Pages sub-path (/<repo>/), or from any static server.
// Override with VITE_BASE if an absolute base is ever needed.
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
