import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Two pages: the home page at / (index.html, static) and the app at /app/ (app/index.html). Paths are from the root.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { home: 'index.html', app: 'app/index.html' },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
});
