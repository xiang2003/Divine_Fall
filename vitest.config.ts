import { defineConfig } from 'vitest/config';

// Unit tests run in plain Node and import no React, so they do not load the React plugin that vite.config.ts uses.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
