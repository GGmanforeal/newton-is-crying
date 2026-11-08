import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Everything is inlined into one dist/index.html, so the built app also works
// when opened straight from disk (file://) — no server needed.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
