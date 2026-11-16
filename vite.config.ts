import { defineConfig } from 'vitest/config';

// VITE_BASE diset oleh GitHub Actions, contoh: /nusantara-ngawur/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  // Three.js sendiri ~600 kB (185 kB gzip); batas peringatan dinaikkan
  build: { outDir: 'dist', assetsDir: 'bundle', sourcemap: true, chunkSizeWarningLimit: 800 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
